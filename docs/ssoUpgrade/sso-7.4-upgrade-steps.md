## SSO 7.4 Upgrade Steps
Note: temporary keeping this as a doc. Once upgrade is completed, move to sso wiki page for the record, and turn into automation for upgrade pipeline.

### Detailed steps that need to be completed during the upgrade process:
```shell
# temporary folder to save files:
mkdir update-tmp-<env>
cd update-tmp-<env>

# remove existing pdb
oc get pdb
oc get pdb sso-dev -o yaml > sso-dev-pdb.yaml
oc delete pdb sso-dev

# make a backup of the route and delete:
oc get routes
oc get routes <sso_route> -o yaml > <sso_route>-route.yaml
oc delete route <sso_route>

# scale sso app down:
oc get dc
oc get dc <sso_dc> -o yaml > <sso_dc>-dc.yaml
oc scale dc <sso_dc> --replicas=0

# make an immediate backup of db:
oc get pods | grep backup
oc rsh <bkup_pod>
  ./backup.sh -l
  ./backup.sh -1
  ./backup.sh -l
  # test restore
  ./backup.sh -r <pgsql_service_name>:5432/<db_name>
  exit

# update patroni storage type
oc get statefulset
oc get statefulset <ss> -o yaml > <ss>.yaml
# 0. update statefulset volume to netapp
cp <ss>.yaml <ss>-netapp.yaml
# 1. scale down statefulset
oc scale statefulset <ss> --replicas=0
# 2. remove PVCs + configmaps + statefulset
oc get all -l "cluster-name=<clsuter_name>"
oc delete all -l "cluster-name=<clsuter_name>"
# 3. create brand new statefulset and wait for it to spin up
oc create -f <ss>-netapp.yaml
# 5. restore db
oc rsh <bkup_pod>
  ./backup.sh -l
  ./backup.sh -r <pgsql_service_name>:5432/<db_name>
  exit

# run manual upgrade
follow section `Manual Steps for RHSSO 7.4 upgrade`

# continue on Jenkins pipeline to create the new PDB, dc and route


# verify app is up, then setup the route with cert
oc apply -f <sso_route>-route.yaml

# check for pdb
oc get pdb


# if things go wrong, shut down app and restore db:
oc scale dc <sso_dc> --replicas=0
oc rsh <bkup_pod>
  > ./backup.sh -r <pgsql_service_name>:5432/<db_name>
```



## Manual Steps for RHSSO 7.4 upgrade
As a direct upgrade with existing instance did not work, we have to manually handle the upgrade with separate job pod and update existing data.

### 1. Obtain upgrade DB script:
(an example run in sandbox env)
1. get a dev backup and restore in sbox
2. follow https://access.redhat.com/documentation/en-us/red_hat_single_sign-on/7.4/html/red_hat_single_sign-on_for_openshift_on_openjdk/tutorials#upgrading-sso-db-from-previous-version

3. setup job template `job-to-migrate-db-to-sso74.yaml`
4. build
```shell
# [image]~[source code]
oc new-build sso:sbox-7.4-78~https://github.com/iankko/openshift-examples.git#KEYCLOAK-8500 \
  --context-dir=sso-manual-db-migration \
  --name=sso74-db-migration-image

# wait till it's completed
oc logs -f bc/sso74-db-migration-image --follow
```

5. update dc with the new image
```shell
PULL_REF=$(oc get istag -n $(oc project -q) --no-headers | grep sso74-db-migration-image | tr -s ' ' | cut -d ' ' -f 2)
sed -i "s#<<SSO_IMAGE_VALUE>>#$PULL_REF#g" job-to-migrate-db-to-sso74.yaml
```

6. start the db migration job
```shell
oc create -f job-to-migrate-db-to-sso74.yaml
oc get dc
# check sso is not running
oc scale job/job-to-migrate-db-to-sso74 --replicas=1
```

7. Get the dynamically generated SQL database migration file
```shell
mkdir -p ./db-update
oc rsync <job_pod>:/opt/eap/keycloak-database-update.sql ./db-update
# Scale down the job
oc scale job/job-to-migrate-db-to-sso74 --replicas=0
```


### 2. Create Upgrade Objects (DC and Configmap) using the same BCGov SSO image:
1. Get the current SSO deployment config as starting point
2. Update the following according to `sso-upgrade-dc.yaml`
  - create configmap <configmap_name> for upgrade version of `standalone-openshift.xml`
  - mount volume from configmap <configmap_name>
  - edit entrypoint to overwrite default config before starting server
  - increase resources (CPU and memory)
  - overwrite jBoss timeout `-Djboss.as.management.blocking.timeout=1200`
  - set to 0 replicas
3. Create the deployment with 0 replicas to test out configurations


### 3. Start DB Update Process:
1. Get the fresh copy of prod data
```shell
oc rsh sso-bkup-4-lrvzf
[backup pod]
  ./backup.sh -l
  # figure out the correct copy to restore
  ./backup.sh -r sso-pgsql-master-sbox-78:5432/rhsso
  # then get all transaction tables in file
  exit
```

2. Remove transaction tables:
```shell
oc rsh <db_primary_pod>
patronictl list
psql -U postgres
  # swtich to correct table
  \c rhsso
  # drop all xxxjbosststxtable tables
  DROP TABLE xxx, xxx, xxx;
  # verify
  \d
  \q
# verify db sync up:
patronictl list
```

3. Apply the database update manually
```shell
# copy sql script
oc rsync --no-perms=true ./db-update/ sso-pgsql-sbox-78-0:/tmp
# apply script to DB
oc rsh sso-pgsql-sbox-78-0
[db pod]
  psql -U sso -d rhsso -W -f /tmp/keycloak-database-update.sql
```

4. check for patroni cluster sync before exiting
```shell
patronictl list
```

### 4.Kickoff Upgrade with Upgrade Objects:
1. scale up the Upgrade DC with 1 replica and monitor:
```shell
oc scale dc <sso_upgrade_dc> --replicas=1
oc get pods --watch
oc logs -f <sso_upgrade_pod>
```

2. Once complete, remove all temporary objects
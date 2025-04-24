# Create an ExternalSecret for the External Secrets Operator

An ExternalSecret contains references to the SecretStore that defines the external service as well as the individual secrets in that external service.

There is a one to one relationship between ExternalSecrets and OpenShift Secrets.  Any secrets (key/value pairs or other kind of secret) that are defined in the ExternalSecret are created within the stated OpenShift Secret.

The main configuration elements of an ExternalSecret are:
* `.spec.secretStoreRef.name` - the name of the SecretStore to use
* `.spec.target.name` - the name of the OpenShift Secret to create
* `.spec.data[].remoteRef` - the names of the keys in both the external secret and OpenShift Secret

Here is an example:
```
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: my-app-1
  namespace: abc123-dev
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: SecretStore
    name: azure-key-vault
  target:
    creationPolicy: Owner
    deletionPolicy: Retain
    name: my-app-1
  data:
    - remoteRef:
        conversionStrategy: Default
        decodingStrategy: None
        key: dev-db-user
        metadataPolicy: None
      secretKey: db-user
    - remoteRef:
        conversionStrategy: Default
        decodingStrategy: None
        key: dev-db-pass
        metadataPolicy: None
      secretKey: db-pass
```

In this example, we have:
* .spec.secretStoreRef.name = azure-key-vault; this is the name of the SecretStore
* .spec.target.name = my-app-1; this is the name of the OpenShift Secret to create
* .spec.data[].remoteRef.key = dev-db-pass; this is the name of the key in the external secret
* .spec.data[].secretKey = db-pass; this is the name of the key for the key/value pair in the OpenShift Secret

For more information when creating an ExternalSecret, use the `oc` CLI, such as:
```
oc explain externalsecret.spec.data
```

```
oc explain externalsecret.spec.refreshInterval
```

or edit it in the YAML view in the OpenShift UI and click on the the 'View sidebar' link.


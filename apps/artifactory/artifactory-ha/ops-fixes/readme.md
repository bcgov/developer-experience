# Ops Fixes

## Docker route issue

Operator has a bug that is stopping it from creating the required docker repo routes.  

99-sample-docker-route.yaml - a template to manually create a docker route
*.env - parameter files for the manually created routes, can track our manual fixes to replace later with automation generated routes.

Sample route fix:

``` bash
login to cluster
oc project devops-artifactory
oc process -f 99-sample-docker-route.yaml --param-file=prd-bcrentities-docker-route.env | oc apply -f -
```

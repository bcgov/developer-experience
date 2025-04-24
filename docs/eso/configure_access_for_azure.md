# Use Azure Key Vault with External Secrets Operator

## Summary
In order to use Azure Key Vault with the External Secrets Operator, a Service Principal must be created with the necessary permissions.  A Secret is then created in the namespaces where SecretStore and ExternalSecret resources will be created.

## Requirements
* Access to your Azure Key Vault
* Access to your OpenShift namespaces
* If using the Azure CLI, podman or docker is recommended

An Azure service principal can be created using the CLI or by logging in to the Azure Portal.  This document describes the CLI process.  To use the portal to create the service principal, see [Register a Microsoft Entra app and create a service principal](https://learn.microsoft.com/en-us/entra/identity-platform/howto-create-service-principal-portal).

## Official Documentation
https://external-secrets.io/latest/provider/azure-key-vault/

## Start the Azure CLI Container
Azure doc: [How to run the Azure CLI in a Docker container](https://learn.microsoft.com/en-us/cli/azure/run-azure-cli-docker)

We recommend that you run the Docker container for the Azure CLI, because installation of the CLI on your workstation involves a lot of package installations and updates, which could potentially cause version issues for other tools you use, and because it's a lot to install for a single task.  You are, of course, welcome to install the CLI directly on your workstation.

You'll need a running Docker server or Podman machine.

Start the container:
```
podman run -it mcr.microsoft.com/azure-cli:cbl-mariner2.0
```

Once it's running and you have a command prompt, run `az` to see version and help information.
```
az
```

Log in to Azure by running `az login` in the container and following the instructions.
```
root [ / ]# az login
To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code AEMMU3WQ3 to authenticate.
```

Make a note of the subscription ID in the output of the login command.

## Create the Service Principal
Azure doc: [Create and use a service principal](https://learn.microsoft.com/en-us/azure/openshift/howto-create-service-principal?wt.mc_id=searchAPI_azureportal_inproduct_rmskilling&sessionId=8f78b3f7c6034d3881394a4bfce6b55e&pivots=aro-azurecli)

You will need
* the subscription ID of your Azure account
* the name of your key vault
* the resource group of your key vault

In the Azure CLI container, set environment variables, entering the appropriate values: 
```
export SUBSCRIPTION_ID="your-subscription-ID"
export KEY_VAULT_NAME="your-key-vault-name"
export RESOURCE_GROUP="your-key-vaults-resource-group"
export SP_NAME="name-of-service-principal-to-create"
```

Run the command to create the service principal:
```
az ad sp create-for-rbac --name "${SP_NAME}" --role "Key Vault Secrets User" --scopes /subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.KeyVault/vaults/${KEY_VAULT_NAME} --sdk-auth
```

Save a copy of the output from this command - you'll need `clientId`, `clientSecret`, and `tenantId`.

## Create the OpenShift Secret
Create a Secret in your OpenShift namespace.  You can use the UI, if you like, or create a YAML manifest and apply it.
```
kind: Secret
apiVersion: v1
metadata:
  name: azure-key-vault-creds
data:
  clientId: MY_CLIENT_ID
  clientSecret: MY_CLIENT_SECRET
  tenantId: MY_TENANT_ID
type: Opaque
```

Apply the manifest:
```
oc apply -f secret.azure-key-vault-creds.yaml
```

## Assign Permissions to Service Principal
Azure doc: [Assign a Key Vault access policy](https://learn.microsoft.com/en-us/azure/key-vault/general/assign-access-policy?tabs=azure-cli)

In the Azure CLI, get a list of service principals.
```
az ad sp list --show-mine
```

If there are more than one, find the entry with the `displayName` that is equal to your new service principal.  Locate the `id` field for that entry and assign it to an environment variable.
```
export OBJECT_ID="the-service-principals-id"
```

Alternatively, let `jq` do it for you:
```
export OBJECT_ID=`az ad sp list --show-mine | jq -r ".[] | select(.displayName == \"${SP_NAME}\") | .id"`
```

Assign permissions:
```
az keyvault set-policy --name ${KEY_VAULT_NAME} --object-id ${OBJECT_ID} --secret-permissions get list
```

## Create a SecretStore
Create a YAML manifest for the SecretStore.  Be sure to enter the correct values for the `tenantId` and the name of the Secret that you created above.
```
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: azure-key-vault
  namespace: e95e89-dev
spec:
  provider:
    azurekv:
      tenantId: "MY_TENANT_ID"
      vaultUrl: https://my-key-vault-name.vault.azure.net/
      authSecretRef:
        clientId:
          name: azure-key-vault-creds
          key: clientId
        clientSecret:
          name: azure-key-vault-creds
          key: clientSecret
```

Now you're ready to [create an ExternalSecret](create-external-secret.md).


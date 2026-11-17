# Practice website

Website for a dental practice: a static [Astro](https://astro.build) site with a few Azure Functions behind `/api`, hosted on Azure Static Web Apps. The current deployment is a draft preview with invented details.

## Requirements

- Node 24 and pnpm (version in `package.json`)
- For the API only: Node 22, because Azure runs the functions on Node 22 and the Functions Core Tools refuse newer versions

## Checks

The same five commands run in CI:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` builds the site into `dist/`, fails if a page contains inline scripts or styles (they would break the Content-Security-Policy), and bundles each function into `api/dist/`.

## Running the site with the API locally

The [Static Web Apps CLI](https://github.com/Azure/static-web-apps-cli) emulates sign-in, roles and `/api`. It needs the [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools) v4 on the `PATH`, running under Node 22.

```bash
pnpm build
cp api/local.settings.example.json api/local.settings.json
swa start dist --api-location api
```

The site is then at http://localhost:4280. Sign in with a made-up user at http://localhost:4280/.auth/login/aad.

[Azurite](https://github.com/Azure/Azurite) stands in for Azure Table Storage:

```bash
docker run --rm -p 127.0.0.1:10002:10002 \
  mcr.microsoft.com/azure-storage/azurite@sha256:830430c1da1a2d537e08f3e6764dd1f5ae00cf0346bcaf625b968ec3f0971fd5 \
  azurite-table --tableHost 0.0.0.0
```

The digest pins Azurite 3.37.0.

## Content

Opening hours, notices, services and practice details live in `src/content/` and are checked against `src/content/schema.ts` at build time. A file that fails the check stops the build, and the published site stays as it is.

## Infrastructure

`infra/` describes the Azure resources with Terraform: a resource group, a storage account with the `content` table, the Static Web App (Free plan) with the storage connection as app setting, and a monthly budget alert.

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # fill in; the file is ignored by git
terraform init
terraform plan -out=site.tfplan
terraform apply site.tfplan
```

Plan again right before every apply. The state file holds the storage key and the deployment token, so it never goes into the repository.

Static Web Apps exists in few regions, and West Europe only accepts tenants that are new to it after a request to Microsoft support. `static_web_app_location` can point elsewhere until that is settled.

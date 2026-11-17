output "site_url" {
  description = "Where the site answers until a custom domain is set up."
  value       = "https://${azurerm_static_web_app.site.default_host_name}"
}

output "static_web_app_name" {
  value = azurerm_static_web_app.site.name
}

output "resource_group_name" {
  value = azurerm_resource_group.site.name
}

output "deployment_token" {
  description = "Lets a deploy upload new files. Read it only when deploying, with terraform output -raw deployment_token."
  value       = azurerm_static_web_app.site.api_key
  sensitive   = true
}

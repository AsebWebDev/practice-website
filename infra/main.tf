locals {
  name = "practice-website-${var.environment}"

  tags = {
    project     = "practice-website"
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "azurerm_resource_group" "site" {
  name     = "rg-${local.name}"
  location = var.location
  tags     = local.tags
}

# Storage account names are global across Azure, so a random suffix keeps
# them unique.
resource "random_string" "storage_suffix" {
  length  = 6
  upper   = false
  special = false
}

# Holds nothing but the table with opening hours and notices. The functions
# reach it with the account key, because the Free plan of Static Web Apps
# offers no managed identity; a leaked key can then change these two rows
# and nothing else.
resource "azurerm_storage_account" "content" {
  name                     = "stpractice${var.environment}${random_string.storage_suffix.result}"
  resource_group_name      = azurerm_resource_group.site.name
  location                 = var.storage_location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"

  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = true

  tags = local.tags
}

resource "azurerm_storage_table" "content" {
  name               = "content"
  storage_account_id = azurerm_storage_account.content.id
}

resource "azurerm_static_web_app" "site" {
  name                = "swa-${local.name}"
  resource_group_name = azurerm_resource_group.site.name
  location            = var.static_web_app_location
  sku_tier            = "Free"
  sku_size            = "Free"

  app_settings = {
    CONTENT_STORAGE = azurerm_storage_account.content.primary_connection_string
  }

  tags = local.tags
}

resource "azurerm_consumption_budget_resource_group" "site" {
  name              = "budget-${local.name}"
  resource_group_id = azurerm_resource_group.site.id
  amount            = var.budget_amount
  time_grain        = "Monthly"

  time_period {
    start_date = "${var.budget_start_date}T00:00:00Z"
  }

  # Costs that have arrived, and costs Azure expects by the end of the month.
  notification {
    enabled        = true
    threshold      = 80
    operator       = "GreaterThan"
    threshold_type = "Actual"
    contact_emails = var.budget_alert_emails
  }

  notification {
    enabled        = true
    threshold      = 100
    operator       = "GreaterThan"
    threshold_type = "Forecasted"
    contact_emails = var.budget_alert_emails
  }
}

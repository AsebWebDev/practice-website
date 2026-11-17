terraform {
  required_version = ">= 1.14"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 5.12.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "= 3.9.1"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

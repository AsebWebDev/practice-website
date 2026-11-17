variable "subscription_id" {
  description = "Azure subscription that holds the site. Kept in an ignored terraform.tfvars, never in the repository."
  type        = string
}

variable "environment" {
  description = "Short name of this copy of the site, such as test or prod. Part of every resource name."
  type        = string

  validation {
    condition     = can(regex("^[a-z]{2,8}$", var.environment))
    error_message = "Use two to eight lower-case letters."
  }
}

variable "location" {
  description = "Azure region inside the EU for the resource group."
  type        = string
  default     = "westeurope"
}

variable "static_web_app_location" {
  description = "Region of the Static Web App, which is where its functions run. Static Web Apps exists in few regions; West Europe is the only one in the EU and does not accept tenants that are new to it without a request to Microsoft support."
  type        = string
  default     = "westeurope"
}

variable "storage_location" {
  description = "Region of the storage account. Separate from location, because Azure may refuse new storage accounts in a busy region; Germany also keeps the data where the practice is."
  type        = string
  default     = "germanywestcentral"
}

variable "budget_alert_emails" {
  description = "Who gets an email when the monthly costs pass the budget."
  type        = list(string)
}

variable "budget_amount" {
  description = "Monthly budget in the subscription's currency. Expected costs are close to zero."
  type        = number
  default     = 5
}

variable "budget_start_date" {
  description = "First day of the month the budget starts, as YYYY-MM-01. Use the current month."
  type        = string

  validation {
    condition     = can(regex("^\\d{4}-\\d{2}-01$", var.budget_start_date))
    error_message = "Use the first day of a month, such as 2026-11-01."
  }
}

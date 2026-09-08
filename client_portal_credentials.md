# Redcliffe Client Portal Credentials

This document records the access details and user credentials for the customized **Redcliffe Client Portal**, shared by Michael (`michael@processflow.ca`) via Bitwarden Send.

## Environment Details
* **Client Portal URL:** [https://redcliffeapp.pfcd.ca](https://redcliffeapp.pfcd.ca)
* **SpiceCRM Backend API:** `rspice.pfcd.ca`
* **Database Architecture:** The frontend does not have its own database. It reads and writes directly from/to the backend SpiceCRM database.

---

## Access & Roles

All accounts share the same password: **`Processredcliffe1!`**

| User Role | Username | Permissions / Scope | App Experience |
| :--- | :--- | :--- | :--- |
| **Customer** | `redcliffe.customer` | Can **only** see their own customer record. | Tailored experience for end-clients. |
| **Financial Planner (Regular)** | `planner.regular` | Can **only** see clients they own. | Standard planner dashboard. |
| **Financial Planner (Senior)** | `planner.senior` | Can see **all** clients in the database. | Senior supervisor dashboard. |

---

> [!NOTE]
> Any edits made to data through the client portal frontend will automatically update the backend SpiceCRM records in real-time.

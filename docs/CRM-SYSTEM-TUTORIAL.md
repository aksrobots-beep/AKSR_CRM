# AK Success CRM System Tutorial

**Service & Maintenance Management**

---

## Table of Contents

1. [Introduction and Getting Started](#1-introduction-and-getting-started)
2. [User Roles and Permissions](#2-user-roles-and-permissions)
3. [Dashboard](#3-dashboard)
4. [Executive View (CEO Dashboard)](#4-executive-view-ceo-dashboard)
5. [Client Management](#5-client-management)
6. [Equipment / Robots](#6-equipment--robots)
7. [Service Tickets](#7-service-tickets)
8. [Inventory Management](#8-inventory-management)
9. [Accounts / Invoices](#9-accounts--invoices)
10. [Suppliers](#10-suppliers)
11. [Reports Module](#11-reports-module)
12. [User Management](#12-user-management)
13. [Settings](#13-settings)
14. [Cross-Module Workflows](#14-cross-module-workflows)
15. [Forgot Password (Secure Reset Flow)](#15-forgot-password-secure-reset-flow)

---

## 1. Introduction and Getting Started

### What is AK Success CRM?

AK Success CRM is a comprehensive service and maintenance management system designed for managing client relationships, robot/equipment deployments, service tickets, inventory, invoicing, and supplier communications. The system provides role-based access so each team member sees the tools relevant to their responsibilities.

### Accessing the System

1. Open your web browser and navigate to the CRM application URL provided by your administrator.
2. You will see the **AK Success CRM** login page with the AK logo and the subtitle "Service & Maintenance Management."

### Logging In

1. Enter your **Email** address in the email field.
2. Enter your **Password** in the password field.
3. Click **Sign In**.
4. If the credentials are correct, you will be redirected to the Dashboard. If not, an error message will appear in red below the heading.

### Navigating the System

Once logged in, the system has two main areas:

- **Sidebar (left):** The vertical navigation menu listing all available modules. The items you see depend on your role. Click any item to switch to that module.
- **Main content area (right):** Displays the currently active module's content, including data tables, stats cards, forms, and modals.

**Sidebar controls:**

- Click the small **arrow button** on the right edge of the sidebar to collapse or expand it. When collapsed, only icons are shown, giving you more screen space.
- Your **name and role** are displayed at the bottom of the sidebar.

---

## 2. User Roles and Permissions

### Role Hierarchy

The system has six user roles, listed from highest to lowest access level:

| Role | Description | Approval Rights |
|------|-------------|-----------------|
| **CEO** | Full access to all modules and data | Yes |
| **Admin** | Full access to all modules (same as CEO for most features) | Yes |
| **HR Manager** | HR and employee management focus | Yes |
| **Finance** | Financial modules and reporting | Yes |
| **Service Manager** | Service operations, tickets, equipment, suppliers | No |
| **Technician** | Service tickets (assigned only), inventory, equipment | No |

### Module Access by Role

| Module | CEO | Admin | Service Manager | Technician | HR Manager | Finance |
|--------|-----|-------|-----------------|------------|------------|---------|
| Dashboard | Yes | Yes | Yes | Yes | Yes | Yes |
| Executive View | Yes | Yes | -- | -- | -- | -- |
| Clients | Yes | Yes | Yes | Yes | Yes | Yes |
| Service Tickets | Yes | Yes | Yes | Yes (own only) | Yes | Yes |
| Equipment | Yes | Yes | Yes | Yes | Yes | Yes |
| Robots | Yes | Yes | Yes | Yes | Yes | Yes |
| Inventory | Yes | Yes | Yes | Yes | Yes | Yes |
| Reports | Yes | Yes | Yes | -- | -- | Yes |
| Accounts | Yes | Yes | -- | -- | -- | Yes |
| Suppliers | Yes | Yes | Yes | -- | -- | -- |
| User Management | Yes | Yes | -- | -- | -- | -- |
| Settings | Yes | Yes | Yes | Yes | Yes | Yes |

### Approval Permissions

Some users have the **Can Approve** flag enabled, which allows them to perform sensitive actions such as approving leave requests and processing invoice payments. This flag is managed in the User Management module.

---

## 3. Dashboard

The Dashboard is the landing page for most users (non-CEO roles). It provides a quick snapshot of the system's current state.

### Stats Cards

At the top of the page, four stat cards display key metrics:

- **Open Tickets** -- Number of service tickets that are not yet resolved or closed.
- **Active Clients** -- Number of clients with an active status.
- **Managed Robots** -- Total number of robots currently in the system.
- **Monthly Revenue** -- Total revenue from paid invoices in the current month.

### Alerts Section

Below the stats, an alerts section highlights items requiring immediate attention:

- **Critical Tickets** -- Tickets marked as critical priority that are still open.
- **Maintenance Warnings** -- Equipment flagged as needing maintenance.

### Recent Activity

A feed showing the last five ticket updates, so you can quickly see what your team has been working on.

### Performance Overview

- **Resolved This Month** -- Count of tickets resolved in the current calendar month.
- **Pending Invoices** -- Number of invoices awaiting payment.
- **Equipment Operational Status** -- Percentage of equipment in operational condition.
- **Ticket Status Distribution** -- A visual breakdown showing how many tickets are in each status category.

---

## 4. Executive View (CEO Dashboard)

The Executive View is available to **CEO** and **Admin** roles only. It provides a comprehensive KPI overview across all modules.

### Revenue and Finance

- **Total Revenue** -- Lifetime revenue from all paid invoices.
- **Monthly Revenue** -- Revenue from invoices paid in the current month.
- **Pending Collection** -- Sum of unpaid amounts across sent and draft invoices.
- **Overdue Invoices** -- Count of invoices past their due date.

### Service Performance

- **Open Tickets** -- Tickets not yet resolved or closed.
- **Critical Issues** -- Tickets with critical priority still open.
- **Resolved This Month** -- Tickets resolved in the current month.
- **Avg Resolution Time** -- Average number of days to resolve a ticket.

### Ticket Distribution

A visual breakdown of all tickets by status, shown as progress bars with percentages.

### Priority Breakdown

A grid showing the count of tickets at each priority level: Critical, High, Medium, and Low.

### Equipment and Assets

- **Total Equipment** -- All equipment records.
- **Operational** -- Equipment currently in working condition.
- **Maintenance Needed** -- Equipment flagged for maintenance.
- **Robots Deployed** -- Total robot count.
- **Inventory Value** -- Total value of all inventory stock.

### Clients Overview

- **Total Clients** -- All client records.
- **Active Clients** -- Clients with active status.
- **Clients with Equipment** -- Clients linked to at least one piece of equipment.

### Alerts and Actions

A consolidated list of items needing attention:

- Critical open tickets
- Equipment requiring maintenance
- Low stock inventory items
- Overdue invoices
- Pending leave requests

### Quick Stats

- **Equipment Uptime** -- Percentage of equipment that is operational.
- **Robot Deployment Rate** -- Percentage of robots currently deployed.
- **Invoice Collection Rate** -- Percentage of invoiced amounts that have been collected.

---

## 5. Client Management

### Viewing Clients

The Clients page shows a data table with all client records. Use the search bar to find clients by name or company.

**Table columns:**

| Column | Description |
|--------|-------------|
| Code | The client code (manually assigned identifier) |
| Company | Company name and contact person name |
| Industry | The client's industry sector |
| Location | City and state |
| Robots | Total robot count, with a badge showing how many are rental |
| Revenue | Monthly revenue from rental equipment |
| Status | Current status (active/inactive) |
| Active | Toggle switch to activate or deactivate the client |
| Last Updated | Timestamp of the last change |
| Actions | Edit and Delete buttons |

### Adding a New Client

1. Click the **Add Client** button in the top-right area.
2. Fill in the form:
   - **Client Code** -- An optional short identifier for the client (e.g., company abbreviation).
   - **Contact Name** (required) -- The primary contact person's name.
   - **Company Name** (required) -- The company's legal or trading name.
   - **Email** -- Contact email address.
   - **Phone** -- Contact phone number.
   - **Address** -- Street address.
   - **City** -- City name.
   - **State** -- State or region.
   - **Industry** -- Select the client's industry sector.
3. Click **Save** to create the client record.

### Editing a Client

1. Click the **Edit** button (pencil icon) on the client's row.
2. Modify any fields as needed.
3. Click **Save** to apply changes.

### Client Detail Panel

Click on a client row to expand the detail panel, which shows:

- Full client information (address, contact details)
- **Robots** -- A list of all equipment/robots linked to this client, with model numbers, ownership type, and rental amounts
- **Monthly Revenue** -- Calculated as the sum of rental amounts from all rental equipment assigned to this client
- **Robot Count** -- Based on the number of model/serial numbers across all equipment entries (not just the number of equipment records)

### Creating a Ticket from a Client

1. In the client detail panel, click **Create Ticket**.
2. Fill in the ticket title, description, and priority.
3. The client is automatically pre-selected.
4. Click **Create** to save the ticket.

### Toggling Active/Inactive

Use the toggle switch in the Active column to deactivate a client. Inactive clients remain in the system but are marked as inactive.

---

## 6. Equipment / Robots

The Equipment and Robots modules share the same underlying data but are presented through different views.

- **Equipment** (sidebar: Equipment) -- Shows all equipment with filter tabs for All, Rental, and Sold.
- **Robots** (sidebar: Robots) -- Shows only robot-type equipment in a focused view.

### Table Columns

| Column | Description |
|--------|-------------|
| Equipment | Name and model of the equipment |
| Ownership | Badge showing "Rental" or "Sold" |
| Models | Count of model/serial numbers registered |
| Client | The client this equipment is assigned to |
| Contract Status | For rental: days remaining on contract. For sold: AMC status and expiry |
| Location | Where the equipment is physically located |
| Installation Date | When the equipment was installed (robots view) |
| Last Service | Date of the most recent resolved service ticket |
| Next Service | Auto-calculated as last service + 3 months (highlighted red if overdue) |
| Status | Operational status |
| Active | Toggle switch |
| Actions | Edit and Delete buttons |

### Adding Equipment

1. Click **Add Equipment** (or **Add Robot** on the Robots page).
2. Fill in the required fields:
   - **Name** (required) -- Equipment/robot name.
   - **Ownership Type** (required) -- Choose **Rental** or **Sold**.
   - **Client** (required) -- Select the client this equipment belongs to.
   - **Model** -- The equipment model name.
   - **Model/Serial Numbers** -- Add one or more serial numbers. Click "Add Another" to add more entries. Each serial number represents an individual unit.

3. **If Ownership Type is "Rental"**, additional fields appear:
   - **Rental Start Date** (required)
   - **Rental End Date** (required) -- Must be after the start date.
   - **Duration (months)** -- Contract duration.
   - **Rental Amount (RM)** -- Monthly rental fee. This value is used to calculate client monthly revenue.
   - **Rental Terms** -- Free-text field for contract terms.

4. **If Ownership Type is "Sold"**, AMC (Annual Maintenance Contract) fields appear:
   - **AMC Start Date**
   - **AMC End Date** -- Must be after the start date if provided.
   - **AMC Amount (RM)** -- Contract value.
   - **Renewal Status** -- Active, Pending, or Expired.
   - **AMC Terms** -- Free-text field for AMC terms.

5. Additional fields for both types:
   - **Manufacturer** -- Select from the supplier list (for robots) or enter manually.
   - **Status** -- Operational, Maintenance Required, Under Maintenance, or Decommissioned.
   - **Installation Date** -- When the equipment was installed.
   - **Last Service Date** -- Date of the most recent service.
   - **Location** -- Physical location.

6. Click **Save** to create the record.

### Contract Expiry Warnings

Equipment nearing contract expiry (within 30 days) will display a warning indicator in the Contract Status column.

### Service History

When viewing an individual equipment's details, the system shows the last 10 service tickets associated with that equipment.

### Creating a Ticket from Equipment

Click the **Create Ticket** option in the equipment detail view. The equipment will be automatically linked to the new ticket.

---

## 7. Service Tickets

Service Tickets are the core of the maintenance workflow. The module supports three different view modes.

### View Modes

Switch between views using the toggle at the top of the page:

- **Kanban Board** -- A visual board with columns for each ticket status. Drag and drop tickets between columns to change their status.
- **Table View** -- A traditional data table with sortable columns and search.
- **Calendar View** -- Tickets arranged on a calendar by due date.

### Ticket Numbering

Tickets are automatically numbered with the format **TKT-YYYY-NNNN** (e.g., TKT-2026-0042). The year resets and the sequence increments automatically.

### Creating a Ticket

1. Click **Add Ticket**.
2. Fill in the form:
   - **Title** (required) -- Brief description of the issue.
   - **Description** -- Detailed explanation.
   - **Client** (required) -- Select the client reporting the issue.
   - **Priority** -- Low, Medium, High, or Critical.
   - **Assign To** -- Select a technician (if you have permission).
   - **Due Date** -- Target resolution date.
   - **Next Action Date** -- Date for the next scheduled action.
   - **Next Action Item** -- Description of the planned next step.
3. Click **Create**.

### Status Workflow

Tickets follow this lifecycle:

```
New --> Assigned --> In Progress --> Pending Parts --> Resolved --> Closed
                                 --> On Hold --------^
```

- **New** -- Ticket just created, not yet assigned.
- **Assigned** -- A technician has been assigned (status updates automatically when a technician is assigned to a "New" ticket).
- **In Progress** -- Work has begun.
- **Pending Parts** -- Waiting for inventory parts to become available.
- **On Hold** -- Temporarily paused.
- **Resolved** -- The issue has been fixed. A resolved timestamp is recorded.
- **Closed** -- Ticket is finalized and archived. A closed timestamp is recorded.

**Kanban drag-and-drop:** In Kanban view, simply drag a ticket card from one status column to another to update its status.

### Assigning a Technician

1. Open the ticket (click on it or use the Assign button).
2. Select a technician from the dropdown.
3. If the ticket was in "New" status, it will automatically change to "Assigned."

### Adding Parts to a Ticket

When a repair requires spare parts:

1. Open the ticket detail.
2. In the Parts section, click **Add Parts**.
3. Select an inventory item and specify the quantity.
4. The system will:
   - Deduct the quantity from inventory stock.
   - Create a stock movement record.
   - Add the parts cost to the ticket's total cost.

### Removing Parts from a Ticket

If parts are returned:

1. Click **Remove** next to the part in the ticket's parts list.
2. The system will:
   - Return the quantity to inventory.
   - Create a "returned" stock movement record.
   - Recalculate the ticket cost.

### Cost Tracking

Each ticket tracks costs automatically:

- **Parts Cost** -- Sum of (unit price x quantity) for all parts used.
- **Labor Cost** -- Manually entered labor charges.
- **Total Cost** -- Parts Cost + Labor Cost (calculated automatically).

### Role-Based Visibility

- **Technicians** see only tickets assigned to them.
- **Service Managers, Admins, and CEO** see all tickets.

### Table Columns

| Column | Description |
|--------|-------------|
| Ticket # | Auto-generated ticket number (TKT-YYYY-NNNN) |
| Title | Brief description of the issue |
| Client | Client who reported the issue |
| Equipment | Linked equipment (name, serial number) |
| Assigned To | Technician assigned to the ticket |
| Priority | Low, Medium, High, or Critical (color-coded) |
| Status | Current status in the workflow |
| Active | Toggle switch |
| Created | Date the ticket was created |
| Due Date | Target resolution date |
| Next Action | Date and item for the next planned action |
| Last Updated | Timestamp of the most recent change |
| Actions | Edit and Delete buttons |

---

## 8. Inventory Management

The Inventory module manages spare parts, consumables, tools, and components used in service operations.

### Overview Stats

Four stat cards at the top provide a quick snapshot:

- **Total Items** -- Number of distinct inventory items.
- **Low Stock Alerts** -- Items where current quantity is at or below the minimum threshold.
- **Total Stock Value** -- Sum of (quantity x unit price) across all items.
- **Categories** -- Number of active inventory categories.

### Low Stock Alerts

When items fall at or below their minimum quantity threshold, a prominent alert banner appears at the top of the page listing the affected items.

### Adding an Inventory Item

1. Click **Add Item**.
2. Fill in the form:
   - **SKU** (required) -- Unique stock-keeping unit code (e.g., RPK030000239).
   - **Name** (required) -- Item name.
   - **Description** -- Additional details (e.g., price notes, specifications).
   - **Category** -- Select one: Spare Parts, Consumables, Tools, or Components.
   - **Quantity** -- Initial stock count (defaults to 0).
   - **Min Quantity** -- Minimum threshold for low stock alerts.
   - **Unit Price** -- Cost per unit.
   - **Currency** -- Select from MYR (Malaysian Ringgit), USD (US Dollar), SGD (Singapore Dollar), or CNY (Chinese Yuan).
   - **Supplier** -- Select from registered suppliers.
   - **Location** -- Storage location.
   - **Track Serial Numbers** -- Enable this toggle if individual units need unique serial numbers (e.g., batteries, screens).
3. **If serial number tracking is enabled** and quantity is greater than 0, text fields will appear for you to enter each unit's serial number. The number of serial number fields matches the quantity.
4. Click **Save**.

### Serial Number Tracking

For items that require individual unit tracking (e.g., each battery has its own serial number):

**Enabling tracking:**

1. When adding or editing an item, toggle **Track Serial Numbers** on.
2. Enter serial numbers for each unit in the quantity.

**Managing serial numbers:**

1. Click the **SN** button on an inventory item's row.
2. The Serial Numbers modal opens, showing all registered serial numbers with their statuses.
3. Available actions:
   - **Add** -- Enter new serial numbers.
   - **Change Status** -- Set a serial number to Available, In Use, Defective, or Retired.
   - **Delete** -- Remove a serial number entry.

**Serial number statuses:**

| Status | Meaning |
|--------|---------|
| Available | In stock and ready for use |
| In Use | Currently deployed (taken out for a service ticket) |
| Defective | Faulty, not usable |
| Retired | Permanently removed from service |

### Taking Parts (Stock Out)

To remove items from inventory (e.g., for a service ticket):

1. Click the **Take Parts** button (arrow-down icon) on the item's row.
2. **For regular items:** Enter the quantity to take and an optional reason/ticket link.
3. **For serial-number-tracked items:** A list of available serial numbers appears with checkboxes. Select the specific units you want to take. The value of selected items is displayed.
4. Optionally link to a service ticket.
5. Click **Take Parts**.
6. The system deducts stock, records a stock movement, and (for SN items) marks the selected serial numbers as "In Use."

### Adding Stock (Stock In)

To add items to inventory:

1. Click the **Add Stock** button (arrow-up icon) on the item's row.
2. **For regular items:** Enter the quantity to add and an optional reason.
3. **For serial-number-tracked items:** Enter the serial numbers for each new unit being added.
4. Click **Add Stock**.
5. The system increases stock, records a stock movement, and (for SN items) creates new serial number entries with "Available" status.

### Stock Movement History

The Recent Stock Movements section below the table shows the last 50 stock changes, including:

- Item name
- Movement type (In or Out)
- Quantity changed
- Reason or linked ticket number
- Date and time
- User who performed the action

### Table Columns

| Column | Description |
|--------|-------------|
| SKU | Stock-keeping unit code |
| Item | Name and description |
| Category | Spare Parts, Consumables, Tools, or Components |
| Stock | Current quantity with low stock warning indicator and min quantity shown |
| SN | Serial number management button (if tracking is enabled) |
| Unit Price | Price with currency symbol (RM, USD, SGD, or CNY) |
| Location | Storage location |
| Active | Toggle switch |
| Last Updated | Timestamp |
| Actions | Edit, Take Parts, Add Stock, Delete buttons |

---

## 9. Accounts / Invoices

The Accounts module handles invoice creation, payment tracking, and financial reporting. Available to **CEO**, **Admin**, and **Finance** roles.

### Overview Stats

- **Total Revenue** -- Lifetime sum of all paid invoice amounts.
- **Pending Payments** -- Total outstanding balance across unpaid invoices.
- **Paid Invoices** -- Count of fully paid invoices.
- **Overdue** -- Count of invoices past their due date.

Additional sections:

- **Recently Paid** -- A list of invoices recently marked as paid.
- **Pending Payment** -- Invoices awaiting payment.
- **This Month** -- Summary stats for the current month, including average invoice value and collection rate.

### Creating an Invoice

1. Click **Create Invoice**.
2. Fill in:
   - **Client** (required) -- Select the client to invoice.
   - **Issue Date** (required) -- The date the invoice is issued.
   - **Due Date** (required) -- The payment deadline.
   - **Line Items** -- Add one or more items:
     - **Description** -- What is being billed.
     - **Quantity** -- Number of units.
     - **Price** -- Price per unit.
     - **Total** -- Automatically calculated (Quantity x Price).
3. The system calculates:
   - **Subtotal** -- Sum of all line item totals.
   - **Tax (6% GST)** -- Applied automatically.
   - **Grand Total** -- Subtotal + Tax.
4. Click **Create**.

### Invoice Numbering

Invoices are automatically numbered with the format **INV-YYYY-NNNN** (e.g., INV-2026-0015).

### Invoice Statuses

| Status | Description |
|--------|-------------|
| Draft | Invoice created but not yet sent to client |
| Sent | Invoice delivered to client, awaiting payment |
| Paid | Full payment received |
| Overdue | Past due date and not fully paid |
| Cancelled | Invoice voided |

### Recording a Payment

1. Click the **Record Payment** button on an invoice row.
2. The modal shows:
   - Invoice number
   - Total amount
   - Amount already paid
   - Balance due
3. Enter the **Payment Amount**.
4. Click **Record Payment**.
5. If the paid amount now equals or exceeds the total, the invoice status automatically changes to **Paid**.
6. The payment amount is added to the client's total revenue.

**Note:** Partial payments are supported. You can record multiple payments against the same invoice until the balance is cleared.

### Editing an Invoice

Click **Edit** on an invoice row to update:

- Status
- Due Date
- Notes

**Restriction:** Paid invoices cannot be deleted.

---

## 10. Suppliers

The Suppliers module manages vendor and supplier contacts along with their communication channels. Available to **CEO**, **Admin**, and **Service Manager** roles.

### Adding a Supplier

1. Click **Add Supplier**.
2. Fill in:
   - **Supplier Name** (required) -- Company or vendor name.
   - **Contact Person** -- Primary contact name.
   - **Email** -- Email address.
   - **WhatsApp** -- WhatsApp number.
   - **WeChat** -- WeChat ID.
   - **Lark** -- Lark contact.
   - **Group Link** -- URL to a group chat or portal (displayed as a clickable link in the table).
   - **QR Code** -- Image URL or Base64-encoded QR code for quick contact scanning.
   - **Notes** -- Additional notes about the supplier.
3. Click **Save**.

### Editing a Supplier

Click **Edit** on a supplier row, modify fields, and click **Save**.

### Toggling Active/Inactive

Use the **Active** toggle switch in the table to deactivate suppliers no longer in use. They remain in the system for historical reference.

### Table Columns

| Column | Description |
|--------|-------------|
| Supplier Name | Company name and contact person |
| Email | Email address |
| WhatsApp | WhatsApp number |
| WeChat | WeChat ID |
| Lark | Lark contact |
| Group Link | Clickable URL to group/portal |
| Status | Active or Inactive |
| Active | Toggle switch |
| Last Updated | Timestamp |
| Actions | Edit and Delete buttons |

---

## 11. Reports Module

The Reports module lets you build custom reports from any module's data. Available to **CEO**, **Admin**, **Finance**, and **Service Manager** roles.

### Building a Report

1. **Select a Module** -- Use the dropdown to choose the data source. Available modules depend on your role:
   - Clients, Equipment, Inventory, Tickets, Invoices, Suppliers, Users, Stock Movements, Ticket Parts, Inventory Serial Numbers, Audit Logs, and more.

2. **Select Columns** -- After choosing a module, checkboxes appear for all available columns. Check the columns you want in your report. Sensitive columns (passwords, tokens) are automatically excluded.

3. **Add Filters** (optional) -- Click **Add Filter** to narrow the data:
   - **Column** -- Select the column to filter on.
   - **Operator** -- Choose an operator based on the column type:
     - **Text columns:** Equals, Not Equals, Contains, In (comma-separated list), Is Null, Is Not Null.
     - **Numeric columns:** Equals, Not Equals, Greater Than, Greater Than or Equal, Less Than, Less Than or Equal, Between, In, Is Null, Is Not Null.
     - **Date columns:** Equals, Greater Than, Greater Than or Equal, Less Than, Less Than or Equal, Between, Is Null, Is Not Null.
   - **Value** -- Enter the filter value. For "Between," enter two values separated by a comma. For "In," enter a comma-separated list.
   - You can add multiple filters, and all are applied together (AND logic).

4. **Preview** -- Click **Preview** to see a table of matching data (up to 50 rows per page with pagination).

5. **Download** -- Click **Download CSV** or **Download XLSX** to export the full result set (up to 5,000 rows).

### Saving a Report Definition

1. After configuring columns and filters, click **Save Report**.
2. Enter a **Report Name**.
3. Optionally check **Public** to make it visible to other users.
4. Click **Save**. The report definition appears in the Saved Reports section.

### Loading a Saved Report

1. In the **Saved Reports** section, click on a saved report.
2. The module, columns, and filters are restored.
3. Click **Preview** to run it, or modify and save again.

### Deleting a Saved Report

Click the **Delete** button next to a saved report. Only the report owner, CEO, or Admin can delete reports.

---

## 12. User Management

The User Management module is for **CEO** and **Admin** roles to manage system accounts.

### Viewing Users

The page displays:

- **Stats Cards** -- Total Users, Active Users, Number of Roles in use, Inactive Users.
- **Role Distribution** -- A breakdown showing how many users are in each role.
- **User Table** -- Full list of all user accounts.

### Table Columns

| Column | Description |
|--------|-------------|
| User | Name, email, and avatar (initials) |
| Role | Role badge (color-coded) |
| Department | Assigned department |
| Status | Active or Inactive |
| Joined | Account creation date |
| Approval | "Can Approve" badge if enabled |
| Actions | Edit and Delete buttons |

### Adding a New User

1. Click **Add User**.
2. Fill in:
   - **Full Name** (required)
   - **Email** (required) -- Must be a valid, unique email address.
   - **Password** (required) -- Minimum 6 characters.
   - **Role** (required) -- Select from: CEO, Admin, Service Manager, Technician, HR Manager, Finance, Inventory Officer.
   - **Department** (required) -- Select from: Management, Service, Sales, Finance, Operations, Inventory.
3. Click **Create**.

### Editing a User

1. Click **Edit** on the user's row.
2. Modify:
   - Full Name
   - Email
   - Phone
   - Role
   - Department
   - **Can Approve** -- Toggle this checkbox to grant or revoke approval permissions (for leave requests and invoices).
3. Click **Save**.

### Deactivating a User

Click **Delete** on a user's row. This performs a soft delete, marking the user as inactive rather than permanently removing them.

---

## 13. Settings

The Settings page lets each user customize their personal preferences. All users have access.

### Profile Tab

- **Full Name** -- Update your display name.
- **Email** -- View or change your email.
- **Phone** -- Add or update your phone number.
- **Department** -- View your department (read-only).
- **Role** -- View your role (read-only, displayed for reference).

### Notifications Tab

Toggle these preferences:

- **Ticket Assigned** -- Receive an email when a ticket is assigned to you.
- **Ticket Updated** -- Receive an email when a ticket you're involved in is updated.
- **Leave Approved** -- Receive an email when your leave request is approved.
- **Browser Notifications** -- Enable desktop browser notifications.
- **Daily Digest** -- Receive a daily summary email of activity.

### Appearance Tab

- **Theme** -- Choose between Light, Dark, or System (follows your operating system preference).
- **Collapsed Sidebar** -- Start with the sidebar collapsed by default.
- **Compact Mode** -- Reduce spacing in the UI for a denser layout.

### System Tab

Displays system information such as the application version and environment details.

---

## 14. Cross-Module Workflows

The modules in AK Success CRM are interconnected. Below are the key end-to-end workflows.

### Client Onboarding to Revenue Tracking

```
Client Created --> Equipment/Robot Assigned --> Rental Contract Configured
                                                        |
                                            Monthly Revenue Auto-Calculated
                                            (sum of all rental amounts)
```

1. Create a new client in **Clients** with their company details and client code.
2. Add equipment/robots in **Equipment** and link them to the client.
3. Set the ownership type to "Rental" and fill in the rental amount.
4. The client's **monthly revenue** is automatically calculated as the sum of rental amounts from all linked rental equipment.
5. The **robot count** on the client record is based on the total number of model/serial numbers across all equipment entries.

### Service Ticket Lifecycle

```
Client Reports Issue --> Ticket Created --> Technician Assigned
        |                                        |
        v                                        v
  Equipment Linked              Work Begins (In Progress)
                                        |
                          Parts Needed? --> Yes --> Take Parts from Inventory
                                |                       |
                                No              Stock Deducted + Movement Logged
                                |                       |
                                v                       v
                          Issue Resolved        Parts Cost Added to Ticket
                                |
                                v
                        Invoice Generated
```

1. A client reports an issue. Create a ticket in **Service Tickets**, linking it to the client and the affected equipment.
2. Assign a technician. The ticket status moves to "Assigned."
3. The technician begins work, updating the status to "In Progress."
4. If spare parts are needed, use **Add Parts** on the ticket. This deducts stock from **Inventory** and records a stock movement. For serial-number-tracked items, specific units are selected and marked as "In Use."
5. When the issue is resolved, set the status to "Resolved." The resolved timestamp is recorded, and the equipment's last service date is updated.
6. Create an invoice in **Accounts** for the service, referencing the parts and labor costs from the ticket.

### Inventory and Stock Flow

```
Supplier Delivers Stock --> Add Stock in Inventory
                                    |
                        (Serial Numbers Added if Tracked)
                                    |
                            Available in Stock
                                    |
                    Service Ticket Needs Parts
                                    |
                        Take Parts from Inventory
                                    |
                (Select Serial Numbers if Tracked)
                                    |
                    Stock Movement Recorded (Out)
                                    |
            Parts Returned? --> Stock Movement Recorded (In)
```

1. When stock arrives from a supplier, use **Add Stock** in the Inventory module. For serial-number-tracked items, enter the serial number for each unit.
2. When parts are needed for a ticket, use **Take Parts**. For SN-tracked items, select the specific serial numbers. Stock is deducted and a movement is logged.
3. If parts are returned (e.g., wrong part used), remove them from the ticket. Stock is returned and a reverse movement is logged.
4. The **Low Stock Alerts** system notifies when items drop to or below minimum quantity.

### Reporting Across Modules

Use the **Reports** module to pull data from any module:

1. Select a module (e.g., Tickets, Inventory, Clients).
2. Choose the columns you want to analyze.
3. Apply filters to narrow the data (e.g., tickets created this month, inventory items with low stock, clients in a specific industry).
4. Preview the results, then download as CSV or XLSX for further analysis or sharing.
5. Save frequently used reports for quick access later.

### Invoice and Revenue Flow

```
Service Completed --> Invoice Created --> Invoice Sent to Client
                                                  |
                                          Payment Received
                                                  |
                                      Record Payment in Accounts
                                                  |
                              Client Total Revenue Updated Automatically
```

1. After completing a service, create an invoice in **Accounts** for the client.
2. Add line items with descriptions, quantities, and prices. Tax (6% GST) is applied automatically.
3. Send the invoice to the client (update status from Draft to Sent).
4. When payment arrives, use **Record Payment** to log the amount.
5. The system supports partial payments. When the full balance is paid, the invoice automatically moves to "Paid" status.
6. The client's total revenue is updated with each payment.

---

## 15. Forgot Password (Secure Reset Flow)

This section explains the secure email-based password reset flow for users who forget their credentials.

### Overview

The forgot-password process has four parts:

1. User submits a forgot-password request.
2. System generates a secure, time-limited reset URL and emails it.
3. System validates reset URL token and expiration.
4. User sets a new password and confirms it.

The design prevents account enumeration, token brute-force, token reuse, and abuse.

### Step 1: Forgot Password Request

**Endpoint:** `POST /api/auth/forgot-password`

**Request body:**

```json
{
  "email": "user@example.com"
}
```

**Processing rules:**

1. Apply rate limits:
   - Per IP (for example: max 5 requests in 15 minutes)
   - Per email (for example: max 3 requests in 30 minutes)
2. Always return a generic response (do not reveal if account exists):
   - "If an account exists for this email, a reset link has been sent."
3. If a matching active user is found:
   - Generate a cryptographically secure random token.
   - Store only a hash of the token in database.
   - Set expiration time (for example: 30 minutes).
   - Optionally invalidate older unused tokens for that user.
   - Send reset email with direct reset link.

### Step 2: Secure Reset URL and Email Delivery

**Reset URL example:**

`https://your-domain.com/reset-password?token=<secure-token>`

**Token requirements:**

- High entropy token (minimum 32 random bytes).
- URL-safe encoding.
- Unguessable and resistant to brute force.
- Stored as hash only (for example: SHA-256 hash of token).

**Email requirements:**

- Clear message: user requested password reset.
- Direct button/link to reset page.
- Expiration notice (for example: "This link expires in 30 minutes.").
- Security note: "If you did not request this, ignore this email."

### Step 3: URL Validation and Expiration Logic

**Validation endpoint:** `GET /api/auth/reset-password/validate?token=<token>`

Token is valid only if all are true:

1. Token format is valid.
2. Matching token hash record exists.
3. Token has not expired (`expires_at` > current time).
4. Token has not been used before (`used_at` is null).
5. User account is still active.

If invalid, expired, or already used, return a generic invalid-token response and show "Reset link is invalid or expired."

### Step 4: Password Reset Form and Confirmation

On the reset page, user enters:

- New Password
- Confirm New Password

Both values must match. Enforce password policy server-side (length/complexity rules).

**Reset endpoint:** `POST /api/auth/reset-password`

**Request body:**

```json
{
  "token": "<secure-token>",
  "newPassword": "NewStrongPassword123!",
  "confirmPassword": "NewStrongPassword123!"
}
```

**On successful reset:**

1. Validate token again on server (do not trust client-side validation alone).
2. Hash and save the new password.
3. Mark token as used (single-use enforcement).
4. Invalidate all active user sessions/tokens.
5. Log password reset event in audit logs.
6. Return success message and redirect user to login.

### Security Rules (Mandatory)

- Never expose whether an email exists in the system.
- Never store plaintext reset tokens.
- Always use HTTPS reset links.
- Token must be one-time use only.
- Token must expire automatically.
- Allow multiple reset requests safely (latest valid token policy recommended).
- Add abuse protection with rate limiting and optional CAPTCHA after repeated attempts.
- Revoke all active sessions after password change.

### Suggested Database Table

Table: `password_reset_tokens`

| Column | Purpose |
|--------|---------|
| `id` | Unique record ID |
| `user_id` | Linked user ID |
| `token_hash` | Hashed reset token |
| `expires_at` | Expiration timestamp |
| `used_at` | Timestamp set after successful reset |
| `created_at` | Created timestamp |
| `request_ip` | Optional requester IP for audit |
| `user_agent` | Optional requester user agent |

### End-to-End Flow Diagram

```
User Clicks "Forgot Password"
            |
            v
Submit Email to /forgot-password
            |
            v
System Responds with Generic Message
            |
            v
If Account Exists -> Generate Secure Token + Expiry
            |
            v
Send Email with HTTPS Reset Link
            |
            v
User Opens Link -> /reset-password?token=...
            |
            v
Validate Token (exists, not expired, not used)
            |
            v
User Enters New Password + Confirm Password
            |
            v
POST /reset-password
            |
            v
Update Password + Mark Token Used + Revoke Sessions
            |
            v
Show Success Message and Redirect to Login
```

---

*AK Success CRM System -- User Tutorial*
*AK Success Sdn Bhd*

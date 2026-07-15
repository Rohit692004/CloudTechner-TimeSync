# CT Orbit Portal - Presentation Slide Deck

Here is the professional 5-6 slide presentation structure designed for your teammate to present before you run the live system demo.

---

## 📊 Slide 1: Title Slide
### **CT Orbit: Next-Gen Timesheet & Resource Staffing Portal**
*Sub-title: Automating compliance, audit integrity, and resource allocation.*

*   **Key Visual Elements**:
    *   CloudTechner Logo
    *   Modern, clean theme with deep emerald green accent colors (`#07241C`) to match the CT Orbit brand.
*   **Slide Content**:
    *   **Presenter**: [Teammate Name]
    *   **Date**: July 14, 2026
    *   **Objective**: Introduce a unified, compliant, and self-service timesheet system.
*   **Speaker Notes**:
    > *"Good morning everyone. Today, we are excited to present CT Orbit, our in-house timesheet and resource allocation system. Orbit is built to replace manual staffing coordination and ensure 100% compliant timesheet tracking, ensuring clear audit paths for every project."*

---

## 📊 Slide 2: The Core Challenge & Solution
### **Problem Statement & The CT Orbit Solution**

*   **Key Visual Elements**:
    *   Two-column comparison (Left: Legacy Challenges, Right: CT Orbit Solution).
*   **Slide Content**:
    *   **Legacy Challenges**:
        *   Manual compliance checks on timesheet comments (e.g., auditing overtime/undertime).
        *   Obsolete or redundant database records when timesheets are updated.
        *   Offline coordination for resource allocation requests.
    *   **The CT Orbit Solution**:
        *   **Smart Policy Engine**: Real-time project-specific validation.
        *   **Data Integrity**: Automatic database scrubbing of outdated comments.
        *   **Self-Service Staffing**: Structured employee-led allocation requests.
*   **Speaker Notes**:
    > *"In managing timesheets, a major challenge is ensuring compliance. Auditing why people logged overtime or short hours is usually manual. Employees frequently edit their hours but leave obsolete notes. Furthermore, staffing unallocated resources is handled via emails or chat. CT Orbit introduces a smart validation engine and a self-service resource pipeline that automates compliance and maintains database cleanliness."*

---

## 📊 Slide 3: Technical Architecture & Security
### **Modern Stack Built for Scale and Safety**

*   **Key Visual Elements**:
    *   Architecture block diagram (Next.js App -> Prisma -> PostgreSQL).
*   **Slide Content**:
    *   **Frontend & Routing**: Next.js (App Router, Server Actions) & React Server Components for instant page loading.
    *   **Styling**: Premium TailwindCSS components paired with custom theme assets.
    *   **Database & Query Engine**: PostgreSQL managed securely with Prisma ORM.
    *   **Security & Guardrails**: NextAuth role-based access controls restricting views for `TS_ADMIN`, `HR_ADMIN`, `PROJECT_MANAGER`, and `EMPLOYEE`.
*   **Speaker Notes**:
    > *"Technically, the portal utilizes a modern Next.js stack, leveraging React Server Components for maximum speed and SEO optimization. On the backend, we run PostgreSQL mapped via Prisma ORM for type-safe database queries. Security is core: NextAuth enforces strict role guardrails. An employee cannot view administrative data, and managers can only approve entries within their oversight scope."*

---

## 📊 Slide 4: Innovation 1 - Smart Comments Validation
### **Project-Specific Validation & Auto-Scrubbing**

*   **Key Visual Elements**:
    *   Flowchart showing hours changing -> policy triggering -> comments showing/hiding.
*   **Slide Content**:
    *   **Flexible Policy Configuration**:
        *   Admins can configure validation rules *per project* (e.g., No Comments, Mandatory Comments, or Dev-time Based).
    *   **The "Combined Deviation Rule"**:
        *   Requires comments *only* if logged hours are less than or greater than 8 hours.
    *   **Automated Data Scrubbing**:
        *   If an employee updates their timesheet to a standard 8-hour shift, any previous obsolete comments are automatically cleared from the server to keep audits clean.
*   **Speaker Notes**:
    > *"One of our biggest enhancements is the Smart Comments Validation. Admins can configure rules at the project level. For projects with standard delivery timelines, our combined 'less than or greater than 8-hour' rule requires notes ONLY for deviations. If an employee logs 6 or 10 hours, they must explain it. If they correct it back to 8 hours, the system auto-scrubs the now-obsolete comments from the database."*

---

## 📊 Slide 5: Innovation 2 - Self-Service Allocation Pipeline
### **Staffing Request Flow & Project History**

*   **Key Visual Elements**:
    *   Step 1 (Employee Requests) -> Step 2 (Admin Approves & Staffs) -> Step 3 (Auto-Populates Timesheet).
*   **Slide Content**:
    *   **Employee-Led Allocation Request**:
        *   Unassigned or migrating employees raise allocation requests specifying project, dates, and allocation percentage directly.
    *   **Admin/HR Staffing Console**:
        *   One-click approval where admins finalize dates and percentages.
    *   **Allocation History**:
        *   A dedicated read-only tab for employees to track current and historical project assignments.
*   **Speaker Notes**:
    > *"To streamline project onboarding, we created a self-service resource pipeline. Unassigned employees can request allocation on active projects directly from their portal. Admins and HR retrieve these requests on their dashboard, confirm staffing percentages and start/end dates, and allocate. The project instantly populates the employee's timesheet grid. We've also added a 'Project History' tab so employees have a clean record of all past allocations."*

---

## 📊 Slide 6: Summary & Core Benefits
### **Key Outcomes & Next Steps**

*   **Key Visual Elements**:
    *   Icons showing a shield (compliance), a broom (clean DB), and a clock (efficiency).
*   **Slide Content**:
    *   **Automated Compliance**: Eliminates manual auditing of timesheet comments.
    *   **Cleaner Database**: Automated background tasks prune stale audit logs.
    *   **Resource Efficiency**: Accelerated staffing allocation cycles.
    *   **Scalability**: Ready to support hundreds of concurrent employees.
*   **Speaker Notes**:
    > *"To summarize, CT Orbit delivers automated compliance checkups, a cleaner database, and highly efficient staffing operations. It is completely ready to scale across the organization. Now, my teammate will show you a live demonstration of these features in action. Thank you."*

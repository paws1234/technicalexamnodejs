# Task 3: Centralized Price Sync - Architectural & Execution Plan

This document outlines the strategic plan for implementing Task 3 of the technical interview assignment using Node.js/Express, Supabase, Next.js, and Vercel.

## 1. Objectives & Scope

* **Central Source:** Maintain a single source of truth for 10 shared SKUs and their respective central prices.
* **Multi-Store Sync:** Automatically propagate price updates to two distinct Shopify Partner development stores when changed centrally.
* **Visibility & Monitoring:** Expose a read endpoint ($GET \ /prices$) flagging any price mismatches across the stores and build a user-facing dashboard for management.

## 2. Technology Stack Selection Rationale

* **Database (Supabase / PostgreSQL):** Provides a free, scalable relational database with instant REST capabilities and robust handling of relational states (products vs. store sync logs).
* **Backend Engine (Node.js & Express):** Lightweight, industry-standard choice for handling API routing ($PATCH \ /prices/:sku$ and $GET \ /prices$) and communicating with third-party web services.
* **Frontend UI (Next.js):** Modern React framework offering seamless routing, rapid UI component styling, and easy integration with API backends.
* **Deployment (Vercel):** Zero-friction serverless hosting platform for both Node.js serverless functions and Next.js frontends, complete with secure environment variable management.

## 3. Step-by-Step Implementation Roadmap

### Phase 1: Environment & Store Preparation

1. **Shopify Partner Setup:** Create two separate free Shopify Partner development stores (e.g., *Store Alpha* and *Store Beta*).
2. **Product Seeding:** Create 10 identical shared SKUs with matching product variants across both Shopify stores manually or via bulk import.
3. **API Access Credentials:** Generate Custom App or Admin API access tokens with inventory/product write permissions for both stores.
4. **Supabase Initialization:** Create a new cloud project, provision the PostgreSQL database, and set up the schema tables:
   * `products`: Stores SKU, product name, and central price.
   * `store_sync_status`: Tracks live prices, last sync timestamps, and sync health (`synced` vs `mismatch`) for each store per SKU.

### Phase 2: Central Backend Service Development

1. **Project Scaffold:** Initialize a Node.js project with Express, CORS, and the Supabase client library configured for serverless deployment.
2. **Database Query Layer:** Implement connection routines to fetch catalog data and sync logs.
3. **Read Route ($GET \ /prices$):**
   * Aggregate central database records with store sync logs.
   * Compare central prices against live store prices to programmatically flag discrepancies (`has_mismatch`).
4. **Update & Sync Route ($PATCH \ /prices/:sku$):**
   * **Step A:** Update the central price in Supabase.
   * **Step B:** Loop through Store A and Store B configurations. For each store, query Shopify's Admin API to locate the variant ID matching the SKU, then execute an update request with the new price.
   * **Step C:** Catch success or failure for each store branch, updating the `store_sync_status` table accordingly (marking as `synced` on success or `mismatch`/`failed` on exception).

### Phase 3: Frontend Dashboard Development (Next.js)

1. **App Layout & Routing:** Build a clean, responsive layout using a modern CSS framework (such as Tailwind CSS).
2. **Data Table Component:** Display the 10 shared SKUs in a tabular view showing the SKU identifier, item name, central price, and individual status columns for Store A and Store B.
3. **Visual Indicators:** Implement color-coded badges (e.g., green for synced, red/yellow for mismatched or failed).
4. **Action Form / Inline Editor:** Provide an input field and update button for each SKU row to trigger the backend patch endpoint seamlessly.

### Phase 4: Deployment & Verification

1. **Backend Deployment:** Push the Express backend to a GitHub repository, link it to Vercel, and configure all secure environment variables (Supabase keys and Shopify store credentials/tokens).
2. **Frontend Deployment:** Push the Next.js application to Vercel as a separate project or integrated frontend, pointing API calls to the deployed backend URL.
3. **End-to-End Testing:**
   * Trigger a price update from the Next.js dashboard.
   * Confirm the database reflects the new central price.
   * Verify via Shopify admin panels that both development stores received the price update.
   * Check that mismatches or errors are properly flagged if a simulated network or authentication failure occurs.
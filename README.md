# CodePush on Cloudflare Workers 🚀

A community-driven port of Microsoft's [CodePush Standalone](https://github.com/microsoft/code-push-server), designed for cost-effective and scalable over-the-air updates using Cloudflare Workers.

**No Servers Needed!** You can now use CodePush Standalone without managing any infrastructure, **nor needing an understanding of it!**

**Status: Alpha 🧪** - Core functionality is **100% compatible ✅** with the official CodePush, but further testing and improvements are ongoing.

**Important Note:** This project is not affiliated with, maintained, or endorsed by Microsoft or the CodePush team. It's a community initiative aimed at providing a more accessible and affordable alternative.

## Why I Built This

This project addresses a crucial need for a reliable and cost-effective solution following Microsoft's planned shutdown of AppCenter CodePush in March 2025.

The official CodePush Standalone server:
   - Is not readily deployable as a true *standalone* solution.
   - Requires a complex setup with Azure infrastructure.
   - Has a difficult-to-maintain codebase with a less-than-ideal TypeScript implementation.

This project provides **a seamless, drop-in replacement 🔌** using Cloudflare Workers, resolving these issues.

## Key Benefits

*   ✨ **Global, Serverless, Effortless:** Deliver updates globally with low latency, powered by Cloudflare's edge network, all without managing any servers.
*   ☁️ **Integrated Cloudflare Infrastructure:**  Utilizes Cloudflare's D1 (SQLite-compatible) for data and R2 (S3-compatible) for package storage, eliminating the need for external services.
*   💰 **Cost-Efficient:** Operates within Cloudflare's cost-optimized serverless environment, minimizing operational overhead.
*   🚀 **Simple Deployment:** Deploy directly to Cloudflare Workers with a streamlined process.
*   ✅ **100% API Compatible:** Functions seamlessly with existing applications using the official CodePush API.

## Features

-   ⚙️ **Fully Compatible API**: Implements the complete CodePush API.
-   💾 **Cloudflare Storage**: Leverages D1 (SQLite) and R2 (S3) for data and package storage.
-   🌐 **Edge Delivery**: Utilizes Cloudflare's edge network for fast updates.
-   ⚡️ **Seamless Deployment:** Deploy your CodePush server to Cloudflare Workers with a streamlined and simplified process, reducing the setup time and effort

## Getting Started

**Base Guide:**
 - `apps/server`: CodePush Standalone Server (Cloudflare Workers)
 - `apps/web`: Admin UI for managing apps, deployments, and releases (optional, Cloudflare Pages)

**Note:** Detailed instructions and commands for each step are **TBD** and will be added soon. Here's a high-level overview:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-repo/code-push-cloudflare-workers.git
    cd code-push-cloudflare-workers
    ```
2.  **Install Dependencies:**
    ```bash
    corepack enable
    pnpm install
    ```
3.  **Configure Cloudflare:**
    -   Install the `wrangler` CLI.
    -   Authenticate with your Cloudflare account.
    -   Create a D1 database and an R2 bucket.
    -   Update `wrangler.toml` with your Cloudflare credentials and other environment variables in the `apps/server` directory.
4.  **Apply Database Migrations:**

    ```bash
    cd apps/server
    pnpm apply
    ```
     or for production enviroment
    ```bash
    pnpm apply:production
    ```

5.  **Deploy the Backend:**
    ```bash
    cd apps/server
    pnpm wrangler publish
    ```
6.  **Run the Admin UI:**
    ```bash
    cd apps/web
    pnpm dev
    ```


## License

Licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for details.

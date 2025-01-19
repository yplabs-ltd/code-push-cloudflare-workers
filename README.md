# CodePush on Cloudflare Workers 🚀

A community-driven port of Microsoft's CodePush Standalone, designed for cost-effective and scalable over-the-air updates using Cloudflare Workers.

**Status: Alpha 🧪** - Core functionality is **100% compatible ✅** with the official CodePush, but further testing and improvements are ongoing.

**Important Note:** This project is not affiliated with, maintained, or endorsed by Microsoft or the CodePush team. It's a community initiative aimed at providing a more accessible and affordable alternative.

## Why I Built This

This project was born out of the need for a reliable and cost-effective alternative to Microsoft's AppCenter CodePush, which is scheduled to shut down in March 2025. Rather than undergoing a complete migration to other solutions like Expo OTA (requiring significant time and effort), this project provides **a seamless, drop-in replacement** using Cloudflare Workers.

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

## License

Licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for details.

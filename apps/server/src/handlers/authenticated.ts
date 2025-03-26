import { getStorageProvider } from "../storage/factory";
import { Context } from "hono";

export const authenticatedHandler = async (c: Context) => {
  const auth = c.get("auth");

  if (!auth || !auth.isAuthenticated) {
    return c.json(
      {
        authenticated: false,
        error: "unauthorized",
        message:
          "The session or access key being used is invalid, please run login again.",
      },
      401
    );
  }

  try {
    const storage = getStorageProvider(c);
    const account = await storage.getAccount(auth.accountId);

    return c.json({
      authenticated: true,
      user: {
        id: account.id,
        email: account.email,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return c.json({
      authenticated: true,
      // User is authenticated but we couldn't fetch details
    });
  }
};

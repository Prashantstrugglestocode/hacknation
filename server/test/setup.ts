import { mock } from "bun:test";

process.env.SUPABASE_URL = "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "mock-key";
process.env.MISTRAL_API_KEY = "mock-mistral-key";
process.env.OPENAI_API_KEY = "mock-openai-key";

mock.module("@supabase/supabase-js", () => {
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: {}, error: null })
          })
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: "mock-id" }, error: null })
          })
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: {}, error: null })
            })
          })
        })
      })
    })
  };
});

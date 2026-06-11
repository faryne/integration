import axios from "axios";

export type DemoHttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface DemoRequestInput {
  method: DemoHttpMethod;
  encryptKey: string;
  encryptedPayload: string;
}

export interface DemoResponse {
  ok: boolean;
  status: number;
  body: string;
}

export async function callEncryptedDemo(input: DemoRequestInput): Promise<DemoResponse> {
  const url = `${import.meta.env.VITE_API_BASE}/auth/encrypted/demo`;
  const headers = {
    "X-Encrypt-Key": input.encryptKey,
    "Content-Type": "text/plain",
  };

  if (input.method === "GET") {
    const response = await axios.get<string>(url, {
      headers,
      params: {
        payload: input.encryptedPayload,
      },
      responseType: "text",
      validateStatus: () => true,
    });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      body: typeof response.data === "string" ? response.data : JSON.stringify(response.data),
    };
  }

  const response = await axios.request<string>({
    url,
    method: input.method,
    headers,
    data: input.encryptedPayload,
    responseType: "text",
    validateStatus: () => true,
  });
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    body: typeof response.data === "string" ? response.data : JSON.stringify(response.data),
  };
}

import type { AsrCloudProfileConfig, AsrProfileConfig } from "@/lib/settings/types";

export interface AliyunCredentialFields {
  appKey: string;
  accessKeyId: string;
  accessKeySecret: string;
}

export interface TencentCredentialFields {
  secretId: string;
  secretKey: string;
}

export function encodeAliyunApiKey(fields: AliyunCredentialFields): string {
  return `${fields.appKey.trim()}:${fields.accessKeyId.trim()}:${fields.accessKeySecret.trim()}`;
}

export function encodeTencentApiKey(fields: TencentCredentialFields): string {
  return `${fields.secretId.trim()}:${fields.secretKey.trim()}`;
}

export function parseAliyunCredentials(
  config: AsrCloudProfileConfig,
): AliyunCredentialFields {
  if (config.appKey || config.accessKeyId || config.accessKeySecret) {
    return {
      appKey: config.appKey ?? "",
      accessKeyId: config.accessKeyId ?? "",
      accessKeySecret: config.accessKeySecret ?? "",
    };
  }

  if (!config.apiKey) {
    return { appKey: "", accessKeyId: "", accessKeySecret: "" };
  }

  const parts = config.apiKey.split(":");
  if (parts.length < 3) {
    return { appKey: "", accessKeyId: "", accessKeySecret: "" };
  }

  return {
    appKey: parts[0] ?? "",
    accessKeyId: parts[1] ?? "",
    accessKeySecret: parts.slice(2).join(":"),
  };
}

export function parseTencentCredentials(
  config: AsrCloudProfileConfig,
): TencentCredentialFields {
  if (config.secretId || config.secretKey) {
    return {
      secretId: config.secretId ?? "",
      secretKey: config.secretKey ?? "",
    };
  }

  if (!config.apiKey) {
    return { secretId: "", secretKey: "" };
  }

  const splitIndex = config.apiKey.indexOf(":");
  if (splitIndex === -1) {
    return { secretId: "", secretKey: "" };
  }

  return {
    secretId: config.apiKey.slice(0, splitIndex),
    secretKey: config.apiKey.slice(splitIndex + 1),
  };
}

export function buildAliyunCloudProfile(fields: AliyunCredentialFields): AsrCloudProfileConfig {
  return {
    kind: "cloud",
    engine: "cloudAliyun",
    appKey: fields.appKey.trim(),
    accessKeyId: fields.accessKeyId.trim(),
    accessKeySecret: fields.accessKeySecret.trim(),
    apiKey: encodeAliyunApiKey(fields),
  };
}

export function buildTencentCloudProfile(fields: TencentCredentialFields): AsrCloudProfileConfig {
  return {
    kind: "cloud",
    engine: "cloudTencent",
    secretId: fields.secretId.trim(),
    secretKey: fields.secretKey.trim(),
    apiKey: encodeTencentApiKey(fields),
  };
}

export function isAliyunCloudComplete(fields: AliyunCredentialFields): boolean {
  return (
    fields.appKey.trim().length > 0 &&
    fields.accessKeyId.trim().length > 0 &&
    fields.accessKeySecret.trim().length > 0
  );
}

export function isTencentCloudComplete(fields: TencentCredentialFields): boolean {
  return fields.secretId.trim().length > 0 && fields.secretKey.trim().length > 0;
}

/** Normalize stored profile into the shape expected by Rust invoke commands. */
export function toRustAsrConfig(config: AsrProfileConfig): AsrProfileConfig {
  if (config.kind === "whisper") {
    return config;
  }

  if (config.engine === "cloudAliyun") {
    const fields = parseAliyunCredentials(config);
    return buildAliyunCloudProfile(fields);
  }

  const fields = parseTencentCredentials(config);
  return buildTencentCloudProfile(fields);
}

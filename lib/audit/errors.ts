export class AuditSchemaError extends Error {
  constructor(
    message: string,
    readonly raw: unknown,
    readonly provider: string
  ) {
    super(message);
    this.name = "AuditSchemaError";
  }
}

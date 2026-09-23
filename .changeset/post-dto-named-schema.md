---
"@civfix/shared": patch
---

`PostDTOSchema` is now annotated as `z.ZodType<PostDTO, z.ZodTypeDef, unknown>` (the same object schema, one named type instead of a structural blow-up), the treatment `PostRefDTOSchema` and `CleanupDTOSchema` already carry. The `coreEndpoints` declaration was within a few percent of the TS7056 serializer cap, so any new field on a DTO that `PostDTO` inlines (`PersonDTO` above all) failed the `.d.ts` build; naming it takes roughly a sixth off that declaration. `parse`/`safeParse`/`nullable`/`optional` and the inferred `PostDTO` are unchanged; the schema is no longer a `ZodObject`, so `.shape`/`.extend` on it (used nowhere) would need the underlying object.

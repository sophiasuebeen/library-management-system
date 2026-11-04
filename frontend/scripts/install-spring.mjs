import { cp, mkdir } from 'node:fs/promises';
const target = new URL('../../library/src/main/resources/static/', import.meta.url);
await mkdir(target, { recursive: true });
await cp(new URL('../dist/client/', import.meta.url), target, { recursive: true });
console.log('React build installed in Spring Boot static resources. Restart Spring Boot to serve the updated UI.');

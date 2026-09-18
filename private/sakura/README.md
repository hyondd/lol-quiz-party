# Private game source

`source.bin` preserves the editable source of the standalone private game, including its embedded artwork and translations. The repository intentionally contains neither the plaintext source nor the access key. Do not publish a decrypted copy under `public/` or add a link to the existing game navigation.

The envelope is `SRC1` (4 bytes), a fresh AES-256-GCM nonce (12 bytes), encrypted `tar.gz` data, and the GCM authentication tag (16 bytes). It uses the same 256-bit base64url key as the owner's private link, with a nonce independent of the deployed payload. Use a trusted local tool to decrypt it and extract it into a private working directory. Never commit the key.

After extraction, install the dependencies from `package.json`, then use `npm run build`. The Vite build is prepared for a self-contained encrypted delivery. Preserve the existing access key, original character IDs and browser save keys when updating the deployed payload. Use a fresh nonce for each encryption.

The live page payload separately uses `SNV1`, a 12-byte AES-GCM nonce, encrypted gzip-compressed self-contained HTML, and a 16-byte authentication tag. Only the loader and encrypted payload belong in `public/sakura/`.

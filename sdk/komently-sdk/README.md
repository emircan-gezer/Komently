# Komently SDK

A lightweight SDK to embed Komently comments and handle cross-domain commenter auth.

## Install

```bash
npm install @komently/sdk
```

## Quick start (React)

Global CSS (required):

Add once in your app entry (e.g., `app/layout.tsx` or `_app.tsx`):

```ts
import '@komently/sdk/styles.css';
```

Render the component with a publicId:

```tsx
import { CommentSection } from '@komently/sdk';

export default function Page() {
  return (
    <CommentSection
      apiKey={process.env.NEXT_PUBLIC_KOMENTLY_API_KEY!}
      publicId="YOUR_PUBLIC_ID"
    />
  );
}
```

## Customization

- Swap subcomponents via render props:
```tsx
<CommentSection
  apiKey="API_KEY"
  publicId="PUBLIC_ID"
  renderForm={({ onSubmit, onLogin, isAuthenticated, currentUser, submitting }) => (
    <div>
      {isAuthenticated ? <span>{currentUser?.firstName ?? 'You'}</span> : <button onClick={onLogin}>Log in</button>}
      <button onClick={() => onSubmit('Hello')} disabled={!isAuthenticated || submitting}>Post</button>
    </div>
  )}
/>
```

- Types are exported for strong typing:
```ts
import type { CommentSectionProps, ReactionHandler } from '@komently/sdk';
```

## Auth flow

- Commenter clicks Log in → popup to Komently domain.
- On success, SDK stores JWT in a cookie `komently_session` on the consumer domain.
- SDK calls `/api/user` to fetch commenter profile (name, avatar, etc.).

## Pagination and replies

- The SDK and API support pagination of top-level comments and per-thread replies via a "Load more" button.
- The server API supports `publicId`, `limit`, `cursor`, and `parentId` query params.

## Non-React (iframe embed)

```ts
import { embedComments } from '@komently/sdk';

element.onload = () => {
  embedComments({ apiKey: 'API_KEY', sectionId: 'SECTION_ID', containerId: 'komently-comments' });
};
```

## Styling

- Default classes are prefixed with `komently-` and shipped as a global CSS file.
- Override styles via your own CSS or custom renderers.


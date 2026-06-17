# FashionOS Admin

Store management panel for FashionOS — Next.js 15 + Firebase.

Connects to the **same Firebase project** as `fashionos-web`. No separate backend needed.

## Stack

| Layer     | Tech                                |
|-----------|--------------------------------------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling   | Tailwind CSS                        |
| Charts    | Recharts                            |
| Forms     | React Hook Form + Zod               |
| Backend   | Firebase Auth + Firestore + Storage |
| Deploy    | Vercel                              |

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Use the **same Firebase config values** as `fashionos-web`'s `.env.local` — both apps share one Firebase project.

### 3. Create your first admin user

The admin panel checks an `admins/{uid}` document in Firestore before granting access. To create the first admin:

1. Sign up a normal user account first — either through the `fashionos-web` register page, or via Firebase Console → Authentication → Add user.
2. Copy that user's UID (Firebase Console → Authentication → Users).
3. In Firestore Console, create a document:
   ```
   Collection: admins
   Document ID: <paste the UID here>
   Fields: { isAdmin: true }
   ```
4. Now log into `fashionos-admin` with that user's email/password.

Every admin user needs a corresponding `admins/{uid}` document with `isAdmin: true`. Without it, login is rejected even with correct credentials (see `src/lib/firebase/helpers.ts → adminLogin`).

### 4. Run dev server

```bash
npm run dev
```

Runs on **port 3001** (so it can run alongside `fashionos-web` on 3000 during local development).

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/      → Admin login
│   └── (admin)/            → All protected admin pages
│       ├── dashboard/
│       ├── products/       → list, add, [id] edit
│       ├── inventory/      → stock across all variants
│       ├── orders/         → list, [id] detail
│       ├── customers/
│       ├── categories/
│       ├── coupons/
│       ├── flash-sales/
│       ├── banners/
│       ├── reviews/
│       ├── reports/        → sales/product/customer/revenue + CSV export
│       └── settings/
├── components/
│   ├── layout/              → Sidebar, TopBar, AdminLayout
│   ├── products/            → ProductForm (shared add/edit)
│   └── ui/                  → Spinner, Badge, Skeleton, EmptyState
├── hooks/useAuth.ts
├── lib/
│   ├── firebase/             → config, helpers (auth + Timestamp conversion)
│   └── utils.ts
├── services/                 → all Firestore query functions
└── types/index.ts
```

## Firestore Rules

This app reuses the **same `firestore.rules`** as `fashionos-web` (already includes the `isAdmin()` check for write access). No separate rules file needed — just make sure you've deployed the rules from the web repo to your shared Firebase project.

## Deploying to Vercel

1. Push this repo to GitHub (separate repo from `fashionos-web`).
2. Import into Vercel.
3. Add the same `NEXT_PUBLIC_FIREBASE_*` environment variables.
4. Deploy. Recommended: protect the deployment with Vercel's password protection or restrict to a specific domain, since this is an internal tool.

## Related

- **Customer Website**: `fashionos-web` (separate repo, same Firebase project)

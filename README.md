# 🚨 Serverless Real-Time War Room Dashboard

A live, interactive dashboard built for incident response, high-stakes project coordination, and real-time team collaboration. This application leverages a modern serverless architecture to ensure instant state synchronization across all connected clients without the overhead of managing custom WebSocket servers.

## ✨ Key Features

* **Real-Time Synchronization:** Powered by Supabase Realtime, any database change (tasks, chat messages, incident status) is instantly broadcast to all connected clients.
* **Edge-Ready Rendering:** Utilizes Next.js App Router and Server Components for near-instant initial page loads and zero layout shift.
* **Secure Multi-Tenancy:** Integrated with Supabase Auth and PostgreSQL Row Level Security (RLS) to ensure users only access incidents they are authorized to view.
* **Modern UI/UX:** Styled with Tailwind CSS and animated for a sleek, responsive, and accessible user experience.

## 🛠️ Technology Stack

* **Framework:** [Next.js](https://nextjs.org/) (React)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Icons:** [Lucide React](https://lucide.dev/)

## 🚀 Getting Started

### Prerequisites

* Node.js 18.17 or later
* A Supabase account and project

### 1. Clone the repository

```bash
git clone [https://github.com/your-username/war-room-dashboard.git](https://github.com/your-username/war-room-dashboard.git)
cd war-room-dashboard
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set up Environment Variables

Create a `.env.local` file in the root directory of the project and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Database Setup (Supabase)

Run the following SQL commands in your Supabase SQL Editor to establish the schema:

```sql
-- Create Incidents Table
CREATE TABLE incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  severity TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Tasks Table
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Messages Table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

*Note: Make sure to enable Realtime (Insert, Update, Delete) for the `incidents`, `tasks`, and `messages` tables in your Supabase dashboard settings.*

### 5. Run the Development Server

```bash
npm run dev
# or
yarn dev
```

Open [https://war-room-dash.vercel.app](https://war-room-dash.vercel.app) with your browser to see the result.

## 📂 Project Structure

```text
├── src/
│   ├── app/                # Next.js App Router (pages, layouts, globals)
│   │   ├── dashboard/      # Protected dashboard routes
│   │   ├── login/          # Authentication pages
│   │   └── ...
│   ├── lib/                # Utility functions and configurations
│   │   └── supabase.ts     # Supabase client initialization
│   └── proxy.ts            # Proxy configurations
├── public/                 # Static assets (SVGs, icons)
├── package.json            # Project dependencies and scripts
├── tailwind.config.ts      # Tailwind CSS configuration (if applicable)
└── tsconfig.json           # TypeScript configuration
```

## 🤝 Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License
This project is licensed under the MIT License.

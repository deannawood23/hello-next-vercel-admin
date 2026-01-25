export default function Home() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-pink-50">
            <div className="rounded-2xl border border-zinc-200 bg-white px-10 py-12 shadow-xl">
                <h1 className="mb-3 text-center text-4xl font-bold tracking-tight text-zinc-900">
                    Hello World!
                </h1>
                <p className="text-center text-zinc-600">
                    My first Next.js app, deployed on Vercel.
                </p>
            </div>
        </main>
    );
}

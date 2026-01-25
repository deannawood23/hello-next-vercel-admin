export default function Home() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-200 via-sky-100 to-blue-200">
            <div className="rounded-3xl bg-white/90 px-12 py-14 shadow-2xl backdrop-blur">
                <h1 className="mb-4 text-center text-4xl font-extrabold tracking-tight text-sky-900">
                    Hello World!
                </h1>
                <p className="text-center text-sky-700">
                    My first Next.js app, deployed on Vercel.
                </p>
            </div>
        </main>
    );
}

interface Props {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#E07628] mb-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">UmaiSense</h1>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-7 py-7">
            <h2 className="text-base font-semibold text-gray-900 mb-6">{title}</h2>
            {children}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function LoadingSpinner({ text = 'Carregando...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-9 h-9 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  )
}

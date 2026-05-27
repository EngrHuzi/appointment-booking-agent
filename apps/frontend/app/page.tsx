import ChatWidget from '@/components/ChatWidget'

// Server Component — just renders the client chat widget
export default function Home() {
  return (
    <main className="h-full">
      <ChatWidget />
    </main>
  )
}

import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BackButton() {
  const navigate = useNavigate()
  return (
    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
      <ChevronLeft className="h-4 w-4" /> 戻る
    </Button>
  )
}

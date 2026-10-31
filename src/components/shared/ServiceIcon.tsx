import Image from 'next/image'
import { cn } from '@/lib/utils'

interface ServiceIconProps {
  selected?: boolean;
  className?: string;
}

export default function ServiceIcon({ selected = false, className = '' }: ServiceIconProps) {
  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center',
        selected ? 'bg-primary-600 text-white' : 'bg-primary-100 text-primary-600',
        className
      )}
    >
      <Image
        src="/logo/logo-simbolo.png"
        alt="Logotipo da Dra. Luciana"
        width={24}
        height={24}
      />
    </div>
  );
}
import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          className={cn(
            'w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-2 focus:ring-primary-500 cursor-pointer',
            className
          )}
          ref={ref}
          {...props}
        />
        {label && (
          <span className="ml-2 text-sm text-gray-700">{label}</span>
        )}
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export default Checkbox


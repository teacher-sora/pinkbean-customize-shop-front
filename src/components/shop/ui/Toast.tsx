'use client'

import clsx from 'clsx'
import { useShop } from '../ShopContext'
import styles from './ui.module.css'

export default function Toast() {
  const { toast, toastText } = useShop()
  return (
    <div role="status" aria-live="polite" className={clsx(styles.toast, toast && styles.toastShow)}>
      <span className={styles.toastDot} />{toastText}
    </div>
  )
}

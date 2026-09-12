import { redirect } from 'next/navigation';

export default function SellerRegisterPage() {
  redirect('/register?role=seller');
}


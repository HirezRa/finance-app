import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>המסך יגיע בשלבים הבאים של הפרויקט.</CardDescription>
      </CardHeader>
    </Card>
  );
}

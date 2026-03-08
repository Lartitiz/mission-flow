import { useParams } from 'react-router-dom';

const ClientView = () => {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-lg text-center space-y-4">
        <h1 className="font-heading text-2xl text-foreground">Espace Client</h1>
        <p className="text-muted-foreground font-body text-sm">
          Token : {token}
        </p>
      </div>
    </div>
  );
};

export default ClientView;

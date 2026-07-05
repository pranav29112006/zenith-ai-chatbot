export default function HomePage() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/chat',
      permanent: false,
    },
  };
}

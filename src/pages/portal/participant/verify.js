const ParticipantVerifyPage = () => {
  return null;
};

export const getServerSideProps = async ({ query }) => {
  const token = query?.token;
  if (!token) {
    return {
      redirect: {
        destination: "/portal/participant?expired=1",
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      destination: `/api/portal/participant/verify?token=${encodeURIComponent(token)}`,
      permanent: false,
    },
  };
};

export default ParticipantVerifyPage;

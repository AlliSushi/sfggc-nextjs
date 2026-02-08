const AdminParticipantDetailPage = () => {
  return null;
};

export const getServerSideProps = async ({ params }) => {
  return {
    redirect: {
      destination: `/portal/participant/${encodeURIComponent(params.pid)}`,
      permanent: false,
    },
  };
};

AdminParticipantDetailPage.getLayout = function getLayout(page) {
  return page;
};

export default AdminParticipantDetailPage;

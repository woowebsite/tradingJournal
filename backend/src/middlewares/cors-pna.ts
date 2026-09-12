// Unused - CORS is handled by Strapi core cors middleware
export default () => {
  return async (_ctx: any, next: any) => {
    await next();
  };
};

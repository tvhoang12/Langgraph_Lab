import { logger } from '@mikro-orm/nestjs';
import axios, { AxiosRequestConfig, Method } from 'axios';

interface ApiRequestParams<TBody = unknown> {
  request_url: string;
  request_method: Method;
  request_body?: TBody;
  request_options?: AxiosRequestConfig;
}

/**
 * Calls an API using axios with the provided configuration.
 * Adheres to snake_case for properties and camelCase for functions.
 */
export const callApi = async <TResponse = unknown, TBody = unknown>(
  params: ApiRequestParams<TBody>,
): Promise<TResponse | null> => {
  const { request_url, request_method, request_body, request_options } = params;
  try {
    const response = await axios<TResponse>({
      url: new URL(request_url).href,
      method: request_method,
      data: request_body,
      ...request_options,
    });
    // logger.log(
    //   `Call API: ${request_url} - ${request_method} - ${JSON.stringify(request_body)} - ${JSON.stringify(response.data)}`,
    // );
    return response.data;
  } catch (error) {
    logger.error(error);
    return null;
  }
};

export const callPlatformApi = async (params: ApiRequestParams) => {
  return callApi({
    ...params,
    request_options: {
      ...params.request_options,
      headers: {
        ...params.request_options?.headers,
        Authorization: `Bearer ${process.env.PLATFORM_API_KEY}`,
      },
    },
  });
};
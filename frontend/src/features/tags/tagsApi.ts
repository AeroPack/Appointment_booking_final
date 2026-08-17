import { api } from '@/core/store/baseApi'

export interface Tag {
  id: string
  name: string
  color: string | null
  description: string | null
  clinic_id: string
  created_at: string
}

export interface CreateTagBody {
  name: string
  color?: string
  description?: string
}

export interface UpdateTagBody {
  name?: string
  color?: string
  description?: string
}

export const tagsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTags: builder.query<Tag[], void>({
      query: () => '/api/tags',
      providesTags: ['Tag'],
    }),
    getTag: builder.query<Tag, string>({
      query: (id) => `/api/tags/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Tag', id }],
    }),
    createTag: builder.mutation<Tag, CreateTagBody>({
      query: (body) => ({
        url: '/api/tags',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Tag'],
    }),
    updateTag: builder.mutation<Tag, { id: string } & UpdateTagBody>({
      query: ({ id, ...body }) => ({
        url: `/api/tags/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Tag'],
    }),
    deleteTag: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/tags/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Tag'],
    }),
    getUserTags: builder.query<Tag[], string>({
      query: (userId) => `/api/users/${userId}/tags`,
      providesTags: (_result, _error, userId) => [{ type: 'Tag', id: `user-${userId}` }],
    }),
    assignTag: builder.mutation<void, { userId: string; tagId: string }>({
      query: ({ userId, tagId }) => ({
        url: `/api/users/${userId}/tags`,
        method: 'POST',
        body: { tag_id: tagId },
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        'Tag',
        { type: 'Tag', id: `user-${userId}` },
      ],
    }),
    unassignTag: builder.mutation<void, { userId: string; tagId: string }>({
      query: ({ userId, tagId }) => ({
        url: `/api/users/${userId}/tags/${tagId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { userId }) => [
        'Tag',
        { type: 'Tag', id: `user-${userId}` },
      ],
    }),
  }),
})

export const {
  useGetTagsQuery,
  useGetTagQuery,
  useCreateTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
  useGetUserTagsQuery,
  useAssignTagMutation,
  useUnassignTagMutation,
} = tagsApi

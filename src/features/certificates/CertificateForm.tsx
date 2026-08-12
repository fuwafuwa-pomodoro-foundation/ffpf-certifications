import { yupResolver } from '@hookform/resolvers/yup'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import * as yup from 'yup'
import { createCertificate } from './api'

const today = new Date().toISOString().slice(0, 10)

const schema = yup.object({
  title: yup.string().trim().required('認定名を入力してください').max(100),
  recipient: yup.string().trim().required('認定者名を入力してください').max(100),
  description: yup.string().trim().required('認定内容を入力してください').max(500),
  issuedAt: yup
    .string()
    .required('認定日を入力してください')
    .matches(/^\d{4}-\d{2}-\d{2}$/, '認定日を入力してください')
    .test('not-in-future', '未来の日付は指定できません', (value) => !value || value <= today),
})

type CertificateInput = yup.InferType<typeof schema>

export function CertificateForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<CertificateInput>({
    resolver: yupResolver(schema),
    defaultValues: { issuedAt: today },
  })
  const mutation = useMutation({
    mutationFn: createCertificate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['certificates'] })
      await navigate({ to: '/' })
    },
  })

  return (
    <section className="panel">
      <p className="eyebrow">Federal registration</p>
      <h1>認定証を登録</h1>
      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        <label>
          認定名
          <input {...register('title')} placeholder="YouTubeでアーキテクチャ動画を見ました" />
          {errors.title && <span role="alert">{errors.title.message}</span>}
        </label>
        <label>
          認定者名
          <input {...register('recipient')} placeholder="Fuwa Fuwa Taro" />
          {errors.recipient && <span role="alert">{errors.recipient.message}</span>}
        </label>
        <label>
          認定内容
          <textarea {...register('description')} rows={5} placeholder="達成したことを自由に記入してください" />
          {errors.description && <span role="alert">{errors.description.message}</span>}
        </label>
        <label>
          認定日
          <input {...register('issuedAt')} type="date" max={today} />
          {errors.issuedAt && <span role="alert">{errors.issuedAt.message}</span>}
        </label>
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? '登録中…' : '連邦に登録する'}
        </button>
        {mutation.isError && <p role="alert">{mutation.error.message}</p>}
      </form>
    </section>
  )
}

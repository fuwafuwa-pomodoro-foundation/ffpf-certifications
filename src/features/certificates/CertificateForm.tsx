import { yupResolver } from '@hookform/resolvers/yup'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import * as yup from 'yup'

const schema = yup.object({
  title: yup.string().trim().required('認定名を入力してください').max(100),
  recipient: yup.string().trim().required('認定者名を入力してください').max(100),
  description: yup.string().trim().required('認定内容を入力してください').max(500),
})

type CertificateInput = yup.InferType<typeof schema>

async function createCertificate(input: CertificateInput) {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return input
}

export function CertificateForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<CertificateInput>({
    resolver: yupResolver(schema),
  })
  const mutation = useMutation({ mutationFn: createCertificate })

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
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? '登録中…' : '連邦に登録する'}
        </button>
        {mutation.isSuccess && <p role="status">認定証を登録しました。</p>}
      </form>
    </section>
  )
}

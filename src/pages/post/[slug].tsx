import { GetStaticPaths, GetStaticProps } from 'next';
import { FiCalendar, FiClock, FiUser } from 'react-icons/fi';
import Prismic from '@prismicio/client';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import { RichText } from 'prismic-dom';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEffect } from 'react';
import Header from '../../components/Header';

import { getPrismicClient } from '../../services/prismic';

import commonStyles from '../../styles/common.module.scss';
import styles from './post.module.scss';

interface Post {
  first_publication_date: string | null;
  last_publication_date: string | null;
  data: {
    title: string;
    banner: {
      url?: string;
    };
    author: string;
    content: {
      heading: string;
      body: {
        text: string;
      }[];
    }[];
  };
}

interface PostProps {
  post: Post;
  prev_page: string;
  next_page: string;
  preview;
}

export default function Post({
  post,
  prev_page,
  next_page,
  preview,
}: PostProps): JSX.Element {
  const router = useRouter();

  if (router.isFallback) {
    return <div>Carregando...</div>;
  }

  const numberOfWords = post.data.content.reduce((acc, content) => {
    if (content.heading) {
      acc += content.heading?.split(' ').length;
    }
    acc += RichText.asText(content.body).split(' ').length;

    return acc;
  }, 0);

  useEffect(() => {
    const script = document.createElement('script');
    const anchor = document.getElementById('inject-comments-for-uterances');
    script.setAttribute('src', 'https://utteranc.es/client.js');
    script.setAttribute('crossorigin', 'anonymous');
    script.setAttribute('repo', 'leonardofps/challenge05-ignite');
    script.setAttribute('issue-term', 'pathname');
    script.setAttribute('theme', 'github-dark');
    anchor.appendChild(script);
  }, []);

  return (
    <>
      <Header />
      <div className={styles.slugContainer}>
        {post.data.banner.url && (
          <img src={post.data.banner.url} alt="Imagem inicial" />
        )}
        <article className={styles.post}>
          <h1>{post.data.title}</h1>
          <div className={styles.articleInfos}>
            <time>
              <FiCalendar />
              {format(new Date(post.first_publication_date), 'dd MMM yyyy', {
                locale: ptBR,
              })}
            </time>

            <span>
              <FiUser />
              {post.data.author}
            </span>
            <span>
              <FiClock />
              {Math.ceil(numberOfWords / 200)} min
            </span>
          </div>

          {post.last_publication_date && (
            <div className={styles.asEditTime}>
              <time>
                {format(
                  new Date(post.last_publication_date),
                  "* 'editado em' dd MMM yyyy 'às' HH:mm",
                  {
                    locale: ptBR,
                  }
                )}
              </time>
            </div>
          )}

          {post.data.content.map(content => (
            <section key={content.heading}>
              <h2>{content.heading}</h2>
              <div
                dangerouslySetInnerHTML={{
                  __html: RichText.asHtml(content.body),
                }}
              />
            </section>
          ))}
        </article>

        <div id="inject-comments-for-uterances" />

        <div className={styles.navigation}>
          {prev_page && (
            <nav className={styles.prevPageButton}>
              <span>{prev_page.data.title}</span>
              <Link href={{ pathname: `${prev_page.uid}` }}>
                <a>Post anterior</a>
              </Link>
            </nav>
          )}

          {next_page && (
            <nav className={styles.nextPageButton}>
              <span>{next_page.data.title}</span>
              <Link href={{ pathname: `${next_page.uid}` }}>
                <a>Próximo post</a>
              </Link>
            </nav>
          )}
        </div>

        {preview && (
          <aside className={styles.previewButton}>
            <Link href="/api/exit-preview">
              <a>Sair do modo preview</a>
            </Link>
          </aside>
        )}
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const prismic = getPrismicClient();
  const posts = await prismic.query([
    Prismic.predicates.at('document.type', 'posts'),
  ]);

  const slugPost = posts.results.map(postUid => {
    return {
      params: {
        slug: postUid.uid,
      },
    };
  });

  return {
    paths: slugPost,
    fallback: true,
  };
};

export const getStaticProps: GetStaticProps = async ({
  params,
  previewData,
  preview = false,
}) => {
  const { slug } = params;

  const prismic = getPrismicClient();
  const response = await prismic.getByUID('posts', String(slug), {
    ref: previewData?.ref ?? null,
  });

  if (!response?.data) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const next_page = await prismic.query(
    Prismic.predicates.at('document.type', 'posts'),
    {
      pageSize: 1,
      after: `${response.id}`,
      orderings: '[document.first_publication_date desc]',
    }
  );

  const prev_page = await prismic.query(
    Prismic.predicates.at('document.type', 'posts'),
    {
      pageSize: 1,
      after: `${response.id}`,
      orderings: '[document.first_publication_date]',
    }
  );

  const post = {
    first_publication_date: response.first_publication_date,
    last_publication_date: response.last_publication_date
      ? response.last_publication_date
      : null,
    uid: response.uid,
    data: {
      title: response.data.title,
      subtitle: response.data.subtitle,
      banner: {
        url: response.data.banner.url ? response.data.banner.url : null,
      },
      author: response.data.author,
      content: response.data.content.map(content => ({
        heading: content.heading || null,
        body: content.body,
      })),
    },
  };

  return {
    props: {
      post,
      next_page: next_page.results[0] || null,
      prev_page: prev_page.results[0] || null,
      preview,
    },
  };
};

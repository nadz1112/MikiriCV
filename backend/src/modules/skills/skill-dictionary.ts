const entries: Array<[string, string[]]> = [
  ['JavaScript', ['javascript', 'js']], ['TypeScript', ['typescript', 'ts']], ['Python', ['python']], ['Java', ['java']], ['C#', ['c#', 'csharp']], ['C++', ['c++']], ['C', ['language c']], ['Go', ['golang', 'go lang']], ['PHP', ['php']], ['Ruby', ['ruby']], ['Kotlin', ['kotlin']], ['Swift', ['swift']], ['Rust', ['rust']], ['Dart', ['dart']], ['Scala', ['scala']], ['R', ['r language']], ['Elixir', ['elixir']], ['Clojure', ['clojure']],
  ['React', ['react', 'reactjs']], ['Angular', ['angular']], ['Vue.js', ['vue', 'vuejs']], ['Next.js', ['next.js', 'nextjs']], ['Nuxt.js', ['nuxt', 'nuxt.js']], ['Svelte', ['svelte']], ['HTML', ['html']], ['CSS', ['css']], ['Tailwind CSS', ['tailwind', 'tailwindcss']], ['Bootstrap', ['bootstrap']], ['Sass', ['sass', 'scss']],
  ['Node.js', ['node.js', 'nodejs', 'node js']], ['Express.js', ['express', 'expressjs']], ['NestJS', ['nestjs', 'nest.js']], ['Django', ['django']], ['Flask', ['flask']], ['FastAPI', ['fastapi']], ['Spring Boot', ['spring boot']], ['ASP.NET', ['asp.net', 'dotnet']], ['Laravel', ['laravel']], ['Ruby on Rails', ['rails', 'ruby on rails']],
  ['PostgreSQL', ['postgresql', 'postgres']], ['MySQL', ['mysql']], ['MongoDB', ['mongodb', 'mongo']], ['Redis', ['redis']], ['SQLite', ['sqlite']], ['Oracle', ['oracle database']], ['Microsoft SQL Server', ['sql server', 'mssql']], ['Elasticsearch', ['elasticsearch']], ['DynamoDB', ['dynamodb']], ['Firebase', ['firebase']],
  ['Docker', ['docker']], ['Kubernetes', ['kubernetes', 'k8s']], ['AWS', ['aws', 'amazon web services']], ['Azure', ['azure']], ['Google Cloud', ['gcp', 'google cloud']], ['Terraform', ['terraform']], ['Jenkins', ['jenkins']], ['GitHub Actions', ['github actions']], ['Git', ['git']], ['Linux', ['linux']], ['GraphQL', ['graphql']], ['REST API', ['rest api', 'restful api']], ['gRPC', ['grpc']], ['Microservices', ['microservices']], ['RabbitMQ', ['rabbitmq']], ['Apache Kafka', ['kafka']], ['Nginx', ['nginx']], ['Jest', ['jest']], ['Vitest', ['vitest']], ['Cypress', ['cypress']], ['Playwright', ['playwright']], ['Pandas', ['pandas']], ['TensorFlow', ['tensorflow']], ['PyTorch', ['pytorch']], ['Figma', ['figma']],
];

export class SkillNormalizer {
  normalize(value: string): string | undefined {
    const normalized = value.trim().toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ');
    return entries.find(([label, aliases]) => label.toLowerCase() === normalized || aliases.some((alias) => alias.toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ') === normalized))?.[0];
  }

  detect(text: string): string[] {
    const lower = text.toLowerCase();
    const found = new Set<string>();
    for (const [label, aliases] of entries) {
      for (const alias of [label, ...aliases]) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        if (new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(lower)) { found.add(label); break; }
      }
    }
    return [...found];
  }
}

export const skillNormalizer = new SkillNormalizer();

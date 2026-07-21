type BlogSearchFormProps = {
  defaultQuery?: string;
  action?: string;
};

export function BlogSearchForm({ defaultQuery = "", action = "/blog" }: BlogSearchFormProps) {
  return (
    <form className="blog-search" action={action} method="get" role="search">
      <label className="blog-search-label">
        <span className="sr-only">Search blog</span>
        <input
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="Search guides…"
          autoComplete="off"
        />
      </label>
      <button className="secondary-action compact-action" type="submit">
        Search
      </button>
    </form>
  );
}

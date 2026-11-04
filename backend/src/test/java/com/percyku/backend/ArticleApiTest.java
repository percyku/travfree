package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class ArticleApiTest extends ApiTestSupport {

	private static final long CREATE_AT_MILLIS = 1774092156547L;

	private static Map<String, Object> articleBody(String title, boolean isPublic) {
		return data(Map.of(
				"id", "",
				"num", -1,
				"title", title,
				"description", "描述",
				"image", "https://example.com/a.jpg",
				"tag", List.of("亞洲"),
				"create_at", CREATE_AT_MILLIS,
				"author", "Oscar",
				"isPublic", isPublic,
				"content", "完整內文"));
	}

	private String createArticle(String title, boolean isPublic) throws Exception {
		adminPost(API + "/admin/article", articleBody(title, isPublic))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已建立文章"));
		return articleRepository.findAll().stream()
				.filter(article -> article.getTitle().equals(title))
				.findFirst().orElseThrow().getId();
	}

	@Test
	void publicArticleAppearsOnFrontWithContentOnlyInDetail() throws Exception {
		String id = createArticle("大英帝國巡禮", true);

		mockMvc.perform(get(API + "/articles"))
				.andExpect(jsonPath("$.articles", hasSize(1)))
				.andExpect(jsonPath("$.articles[0].id").value(id))
				.andExpect(jsonPath("$.articles[0].isPublic").value(true))
				.andExpect(jsonPath("$.articles[0].tag[0]").value("亞洲"))
				.andExpect(jsonPath("$.articles[0].num").value(1))
				.andExpect(jsonPath("$.articles[0].content").doesNotExist())
				.andExpect(jsonPath("$.messages", hasSize(0)));

		mockMvc.perform(get(API + "/article/" + id))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.article.content").value("完整內文"))
				.andExpect(jsonPath("$.article.author").value("Oscar"));
	}

	@Test
	void createAtKeepsMillisecondsSentByFrontend() throws Exception {
		String id = createArticle("文章", true);

		long createAt = read(mockMvc.perform(get(API + "/article/" + id))).at("/article/create_at").asLong();
		assertThat(createAt).isEqualTo(CREATE_AT_MILLIS);
	}

	@Test
	void privateArticleIsHiddenFromFrontButVisibleToAdmin() throws Exception {
		String id = createArticle("草稿", false);

		mockMvc.perform(get(API + "/articles")).andExpect(jsonPath("$.articles", hasSize(0)));
		mockMvc.perform(get(API + "/article/" + id))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到文章"));
		adminGet(API + "/admin/article/" + id).andExpect(jsonPath("$.article.title").value("草稿"));
	}

	@Test
	void adminListIncludesContentSoEditingDoesNotOverwriteIt() throws Exception {
		createArticle("文章", true);

		adminGet(API + "/admin/articles")
				.andExpect(jsonPath("$.articles[0].content").value("完整內文"))
				.andExpect(jsonPath("$.pagination.current_page").value(1));
	}

	@Test
	void updateAndDelete() throws Exception {
		String id = createArticle("舊標題", true);

		adminPut(API + "/admin/article/" + id, articleBody("新標題", true))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已更新文章"));
		mockMvc.perform(get(API + "/article/" + id)).andExpect(jsonPath("$.article.title").value("新標題"));

		mockMvc.perform(auth(delete(API + "/admin/article/" + id)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已刪除文章"));
		mockMvc.perform(auth(delete(API + "/admin/article/" + id)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到文章"));
	}

	@Test
	void missingRequiredFieldIsRejected() throws Exception {
		adminPost(API + "/admin/article", data(Map.of("title", "只有標題")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false));
	}
}

package com.percyku.backend.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Function;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

public record PagedResult<T>(List<T> items, PaginationDto pagination) {

	public static final int PAGE_SIZE = 10;

	/**
	 * 比照 Hexschool 的分頁行為：page 無效時視為第 1 頁、超過末頁時回傳最後一頁、
	 * 沒有任何資料時 current_page 為 0（2026-11-04 對照真實 API 確認），
	 * 每筆的 num 是它在整份清單中的名次（從 1 開始），由 mapper 第二個參數帶入。
	 */
	public static <E, T> PagedResult<T> fetch(String pageParam, String category, Sort sort,
			Function<Pageable, Page<E>> query, BiFunction<E, Integer, T> mapper) {
		int requested = parsePage(pageParam);
		Page<E> page = query.apply(PageRequest.of(requested - 1, PAGE_SIZE, sort));
		if (page.getTotalPages() > 0 && requested > page.getTotalPages()) {
			page = query.apply(PageRequest.of(page.getTotalPages() - 1, PAGE_SIZE, sort));
		}

		List<T> items = new ArrayList<>();
		int num = (int) page.getPageable().getOffset();
		for (E entity : page.getContent()) {
			items.add(mapper.apply(entity, ++num));
		}
		return new PagedResult<>(items, new PaginationDto(
				page.getTotalPages(),
				page.getTotalPages() == 0 ? 0 : page.getNumber() + 1,
				page.hasPrevious(),
				page.hasNext(),
				category == null ? "" : category));
	}

	private static int parsePage(String pageParam) {
		try {
			return Math.max(Integer.parseInt(pageParam), 1);
		} catch (NumberFormatException e) {
			return 1;
		}
	}
}

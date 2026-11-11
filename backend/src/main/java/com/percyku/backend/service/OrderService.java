package com.percyku.backend.service;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.dto.LineItemResponse;
import com.percyku.backend.dto.OrderCreateRequest;
import com.percyku.backend.dto.OrderResponse;
import com.percyku.backend.dto.OrderUpdateRequest;
import com.percyku.backend.dto.PagedResult;
import com.percyku.backend.entity.CartItem;
import com.percyku.backend.entity.Order;
import com.percyku.backend.entity.OrderItem;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.OrderRepository;
import com.percyku.backend.repository.UserRepository;

@Service
@Transactional(readOnly = true)
public class OrderService {

	private static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("createAt"), Sort.Order.desc("id"));

	private final OrderRepository orderRepository;
	private final CartService cartService;
	private final UserRepository userRepository;

	public OrderService(OrderRepository orderRepository, CartService cartService, UserRepository userRepository) {
		this.orderRepository = orderRepository;
		this.cartService = cartService;
		this.userRepository = userRepository;
	}

	public PagedResult<OrderResponse> page(String page) {
		return PagedResult.fetch(page, null, NEWEST_FIRST, orderRepository::findAll, OrderResponse::from);
	}

	/** 查無訂單時回傳 null：Hexschool 此時回 200 與 order:null。 */
	public OrderResponse get(String id) {
		return orderRepository.findById(id).map(order -> OrderResponse.from(order, null)).orElse(null);
	}

	/** 結帳帳號（userId）的購物車，訂單記錄這個帳號。權限（需要 USER）由 SecurityConfig 檢查。 */
	@Transactional
	public Order create(String userId, OrderCreateRequest request) {
		List<CartItem> items = cartService.memberItems(userId);
		if (items.isEmpty()) {
			throw ApiException.badRequest("購物車無資料");
		}
		if (items.stream().anyMatch(item -> !item.getProduct().isEnabled())) {
			throw ApiException.badRequest("購物車內有已下架產品");
		}

		List<LineItemResponse> lines = items.stream().map(LineItemResponse::from).toList();
		long finalTotal = lines.stream().mapToLong(LineItemResponse::finalTotal).sum();
		// 在任何寫入之前比對，不符時不建立訂單、不清空購物車
		if (request.finalTotal() != null && request.finalTotal() != finalTotal) {
			throw new ApiException(HttpStatus.CONFLICT, "訂單金額已變動，請重新確認");
		}

		Order order = new Order(userRepository.getReferenceById(userId), request.user(), request.message(), now());
		int sortOrder = 0;
		for (LineItemResponse line : lines) {
			order.addItem(new OrderItem(order, line, sortOrder++));
		}
		orderRepository.save(order);
		cartService.clearMember(userId);
		return order;
	}

	@Transactional
	public void update(String id, OrderUpdateRequest request) {
		Order order = find(id);
		if (request.isPaid() != null) {
			order.updatePaid(request.isPaid(), now());
		}
		if (request.status() != null) {
			order.setStatus(request.status());
		}
	}

	@Transactional
	public void pay(String id) {
		Order order = find(id);
		if (order.isPaid()) {
			throw ApiException.badRequest("訂單已付款");
		}
		order.updatePaid(true, now());
	}

	@Transactional
	public void delete(String id) {
		orderRepository.delete(find(id));
	}

	@Transactional
	public void deleteAll() {
		orderRepository.deleteAll();
	}

	private Order find(String id) {
		return orderRepository.findById(id).orElseThrow(() -> ApiException.notFound("找不到訂單"));
	}

	private static long now() {
		return Instant.now().getEpochSecond();
	}
}

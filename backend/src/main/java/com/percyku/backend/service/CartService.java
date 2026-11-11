package com.percyku.backend.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.cart.CartOwner;
import com.percyku.backend.dto.CartRequest;
import com.percyku.backend.dto.CartSummary;
import com.percyku.backend.dto.LineItemResponse;
import com.percyku.backend.entity.Cart;
import com.percyku.backend.entity.CartItem;
import com.percyku.backend.entity.Coupon;
import com.percyku.backend.entity.Product;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.CartItemRepository;
import com.percyku.backend.repository.CartRepository;
import com.percyku.backend.repository.CouponRepository;
import com.percyku.backend.repository.ProductRepository;
import com.percyku.backend.repository.UserRepository;

/**
 * 每個訪客與帳號各一台購物車，由 CartOwner 決定。購物車在第一次加入商品時建立；
 * 讀取、修改、刪除時購物車不存在就視為空的，所以只有加入商品會因為沒有識別而失敗。
 */
@Service
@Transactional(readOnly = true)
public class CartService {

	private static final String NOT_IN_CART = "找不到購物車品項";

	private final CartRepository cartRepository;
	private final CartItemRepository cartItemRepository;
	private final ProductRepository productRepository;
	private final CouponRepository couponRepository;
	private final UserRepository userRepository;

	public CartService(CartRepository cartRepository, CartItemRepository cartItemRepository,
			ProductRepository productRepository, CouponRepository couponRepository, UserRepository userRepository) {
		this.cartRepository = cartRepository;
		this.cartItemRepository = cartItemRepository;
		this.productRepository = productRepository;
		this.couponRepository = couponRepository;
		this.userRepository = userRepository;
	}

	public CartSummary summary(CartOwner owner) {
		return summaryOf(items(owner));
	}

	/** 同一產品重複加入時累加數量：前端以 product.id 當 React key，每個產品只能有一列。 */
	@Transactional
	public LineItemResponse add(CartOwner owner, CartRequest request) {
		Product product = productRepository.findById(request.productId())
				.orElseThrow(() -> ApiException.notFound("找不到產品"));
		if (!product.isEnabled()) {
			throw ApiException.badRequest("產品已下架");
		}
		Cart cart = findOrCreate(owner);
		CartItem item = cartItemRepository.findByCartIdAndProductId(cart.getId(), product.getId()).orElse(null);
		if (item == null) {
			item = cartItemRepository.save(new CartItem(cart, product, request.qty()));
		} else {
			int merged = item.getQty() + request.qty();
			if (merged > CartRequest.MAX_QTY) {
				throw ApiException.badRequest("qty 不得大於 " + CartRequest.MAX_QTY);
			}
			item.setQty(merged);
		}
		return LineItemResponse.from(item);
	}

	@Transactional
	public LineItemResponse update(CartOwner owner, String id, CartRequest request) {
		CartItem item = findItem(owner, id);
		if (!item.getProduct().getId().equals(request.productId())) {
			throw ApiException.badRequest("product_id 與購物車品項不符");
		}
		item.setQty(request.qty());
		return LineItemResponse.from(item);
	}

	@Transactional
	public void delete(CartOwner owner, String id) {
		cartItemRepository.delete(findItem(owner, id));
	}

	@Transactional
	public void clear(CartOwner owner) {
		findCart(owner).ifPresent(cart -> cartItemRepository.deleteByCartId(cart.getId()));
	}

	/** 清除購物車所有品項的優惠券。沒有套用或購物車是空的也視為成功。 */
	@Transactional
	public long removeCoupon(CartOwner owner) {
		List<CartItem> items = items(owner);
		items.forEach(item -> item.setCoupon(null));
		return summaryOf(items).finalTotal();
	}

	/** 只套用在目前購物車內的品項，之後才加入的品項不帶優惠（與 Hexschool 相同）。 */
	@Transactional
	public long applyCoupon(CartOwner owner, String code) {
		Coupon coupon = couponRepository.findByCode(code)
				.filter(Coupon::isEnabled)
				.orElseThrow(() -> ApiException.notFound("找不到優惠券"));
		if (coupon.getDueDate() < Instant.now().getEpochSecond()) {
			throw ApiException.badRequest("優惠券已過期");
		}
		List<CartItem> items = items(owner);
		if (items.isEmpty()) {
			throw ApiException.badRequest("購物車無資料");
		}
		items.forEach(item -> item.setCoupon(coupon));
		return summaryOf(items).finalTotal();
	}

	/**
	 * 把訪客購物車併入帳號的購物車後刪除訪客購物車。同一產品的數量相加（上限 9999），優惠券以帳號原本的為準；
	 * 帳號沒有的產品整列移過去，保留原本的優惠券。訪客購物車不存在或是空的就只回傳帳號的購物車。
	 */
	@Transactional
	public CartSummary merge(String userId, String guestHeader) {
		String guestId = CartOwner.parseGuestId(guestHeader);
		CartOwner member = CartOwner.member(userId);
		Optional<Cart> guestCart = guestId == null ? Optional.empty() : cartRepository.findByGuestId(guestId);
		if (guestCart.isEmpty()) {
			return summary(member);
		}
		List<CartItem> guestItems = cartItemRepository.findAllWithDetailsByCartId(guestCart.get().getId());
		if (!guestItems.isEmpty()) {
			Cart memberCart = findOrCreate(member);
			Map<String, CartItem> memberItems = cartItemRepository.findAllWithDetailsByCartId(memberCart.getId())
					.stream()
					.collect(Collectors.toMap(item -> item.getProduct().getId(), Function.identity()));
			for (CartItem guestItem : guestItems) {
				CartItem existing = memberItems.get(guestItem.getProduct().getId());
				if (existing == null) {
					guestItem.moveTo(memberCart);
				} else {
					existing.setQty(Math.min(existing.getQty() + guestItem.getQty(), CartRequest.MAX_QTY));
					cartItemRepository.delete(guestItem);
				}
			}
			// 先寫入移動與刪除，再刪除訪客購物車，否則 cart_lines 的外鍵會擋下
			cartItemRepository.flush();
		}
		cartRepository.delete(guestCart.get());
		return summary(member);
	}

	/** 結帳用：帳號購物車的品項（含產品與優惠券）。 */
	List<CartItem> memberItems(String userId) {
		return items(CartOwner.member(userId));
	}

	void clearMember(String userId) {
		clear(CartOwner.member(userId));
	}

	private List<CartItem> items(CartOwner owner) {
		return findCart(owner)
				.map(cart -> cartItemRepository.findAllWithDetailsByCartId(cart.getId()))
				.orElseGet(List::of);
	}

	private CartItem findItem(CartOwner owner, String id) {
		return findCart(owner)
				.flatMap(cart -> cartItemRepository.findWithDetailsByIdAndCartId(id, cart.getId()))
				.orElseThrow(() -> ApiException.notFound(NOT_IN_CART));
	}

	private Optional<Cart> findCart(CartOwner owner) {
		if (owner.isMember()) {
			return cartRepository.findByUserId(owner.userId());
		}
		if (owner.guestId() != null) {
			return cartRepository.findByGuestId(owner.guestId());
		}
		return Optional.empty();
	}

	private Cart findOrCreate(CartOwner owner) {
		if (owner.isAnonymous()) {
			throw ApiException.badRequest("缺少 " + CartOwner.HEADER);
		}
		return findCart(owner).orElseGet(() -> cartRepository.save(owner.isMember()
				? Cart.forUser(userRepository.getReferenceById(owner.userId()))
				: Cart.forGuest(owner.guestId())));
	}

	private static CartSummary summaryOf(List<CartItem> items) {
		return CartSummary.of(items.stream().map(LineItemResponse::from).toList());
	}
}
